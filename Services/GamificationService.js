import mongoose from "mongoose";
import Gamification, { XP_PER_LEVEL, XP_REASONS, levelForXP } from "../Models/Gamification.js";
import { StudentBadge } from "../Models/Badge.js";
import { evaluateBadges } from "./BadgeEvaluator.js";
import { createNotificationService } from "./NotificationService.js";
import StudentProfile from "../Models/studentProfile.js";
import { emitToUser } from "../Utilities/SocketManager.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";

export const SESSION_ATTENDED_XP = 15;
const MAX_PAGE_SIZE = 100;

// Human-friendly phrasing for XP reasons, used in notification messages.
const XP_REASON_LABELS = {
  task_submit: "submitting a task",
  task_submit_late: "a late task submission",
  review_perfect: "a perfect review score",
  review_excellent: "an excellent review score",
  session_attended: "attending a session",
  streak_bonus: "a streak bonus",
  challenge_solved: "solving a challenge",
  puzzle_solved: "solving a puzzle",
  exam_passed: "passing an exam",
  badge_bonus: "a badge bonus",
  lesson_completed: "completing a lesson",
};

// A source document earns XP once per group: a submission gets submit XP once
// (on time or late, however often it is re-saved) and review XP once.
const AWARD_GROUPS = {
  task_submit: ["task_submit", "task_submit_late"],
  task_submit_late: ["task_submit", "task_submit_late"],
  review_perfect: ["review_perfect", "review_excellent"],
  review_excellent: ["review_perfect", "review_excellent"],
};

// Stats counters (used by badge conditions) bumped by each XP reason.
const STATS_FOR_REASON = {
  task_submit: ["tasksSubmitted", "tasksOnTime"],
  task_submit_late: ["tasksSubmitted"],
  session_attended: ["sessionsAttended"],
  challenge_solved: ["challengesSolved"],
  puzzle_solved: ["puzzlesSolved"],
  exam_passed: ["examsAbovePassing"],
  review_perfect: ["perfectScores"],
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

const daysBetween = (earlier, later) => Math.round((startOfDay(later) - startOfDay(earlier)) / DAY_MS);

/**
 * Streak after activity at `now`: same day keeps it, the next day extends it,
 * any longer gap restarts it at 1.
 */
const nextStreak = (gamification, now) => {
  const today = startOfDay(now);
  if (!gamification.lastActivityDate) return { currentStreak: 1, lastActivityDate: today };

  const gap = daysBetween(gamification.lastActivityDate, now);
  if (gap === 0) return { currentStreak: gamification.currentStreak || 1, lastActivityDate: today };
  if (gap === 1) return { currentStreak: (gamification.currentStreak || 0) + 1, lastActivityDate: today };
  return { currentStreak: 1, lastActivityDate: today };
};

/**
 * The stored streak only changes when XP is earned, so a student inactive since
 * before yesterday still has their old streak on file. Report it as broken.
 */
export const liveStreak = (gamification, now = new Date()) => {
  if (!gamification?.lastActivityDate) return 0;
  return daysBetween(gamification.lastActivityDate, now) <= 1 ? gamification.currentStreak : 0;
};

export const startOfYesterday = (now = new Date()) => new Date(startOfDay(now).getTime() - DAY_MS);

export const boundedPagination = (queryString = {}, defaultLimit = 20) => {
  const page = Math.max(parseInt(queryString.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryString.limit, 10) || defaultLimit, 1), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
};

const toObjectId = (value) => {
  const id = value?._id ?? value;
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
};

// ─── Ensure Profile ──────────────────────────────────────────────────────────
/**
 * Lazily creates a Gamification document on first interaction.
 * Returns the existing or newly created document.
 */
export const ensureProfile = async (studentProfileId) => Gamification.findOneAndUpdate({ studentProfileId }, { $setOnInsert: { studentProfileId } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });

// ─── Award XP ────────────────────────────────────────────────────────────────
/**
 * Central XP award function. All gamification XP flows through here.
 *
 * Awards are atomic, so concurrent awards cannot overwrite each other, and
 * idempotent per source: when `sourceId` is given, a second award for the same
 * source and reason group is a no-op. Hooks that fire on every save rely on this.
 *
 * @param {string} studentProfileId
 * @param {number} amount - XP to award
 * @param {string} reason - One of the xpHistory.reason enum values
 * @param {string} [sourceId] - ObjectId of the source document
 * @returns {{ gamification, leveledUp, newlyUnlockedBadges }}
 */
export const awardXP = async (studentProfileId, amount, reason, sourceId = null) => {
  const nothingAwarded = { gamification: null, leveledUp: false, newlyUnlockedBadges: [] };
  if (!(amount > 0)) return nothingAwarded;
  if (!XP_REASONS.includes(reason)) throw new Error(`Unknown XP reason: ${reason}`);

  const current = await ensureProfile(studentProfileId);
  const now = new Date();
  const streak = nextStreak(current, now);
  const source = sourceId ? toObjectId(sourceId) : null;

  const filter = { _id: current._id };
  if (source) {
    filter.xpHistory = {
      $not: { $elemMatch: { sourceId: source, reason: { $in: AWARD_GROUPS[reason] || [reason] } } },
    };
  }

  const inc = { xp: amount, lifetimeXP: amount };
  for (const stat of STATS_FOR_REASON[reason] || []) inc[`stats.${stat}`] = 1;

  const updated = await Gamification.findOneAndUpdate(
    filter,
    {
      $inc: inc,
      $push: { xpHistory: { amount, reason, sourceId: source, awardedAt: now } },
      $set: streak,
      $max: { longestStreak: streak.currentStreak },
    },
    { returnDocument: "after" },
  );
  if (!updated) return nothingAwarded; // already awarded for this source

  const previousLevel = levelForXP(updated.xp - amount);
  await Gamification.updateOne({ _id: updated._id }, { $max: { level: levelForXP(updated.xp) } });

  // Badges may add bonus XP, so read the totals for notifications afterwards.
  const newlyUnlockedBadges = await evaluateBadges(studentProfileId);
  const gamification = await Gamification.findById(updated._id);
  const leveledUp = gamification.level > previousLevel;

  // Resolve the student's user id + parents once for all notifications below.
  // (auto-populated by StudentProfile's pre-find hook). Best-effort — a profile
  // load failure must not break XP awarding.
  let studentUserId = null;
  let studentName = "Your child";
  let parentIds = [];
  try {
    const profile = await StudentProfile.findById(studentProfileId);
    if (profile?.user) {
      studentUserId = profile.user._id?.toString?.() || profile.user.toString();
      studentName = profile.user.FullName || studentName;
    }
    parentIds = (profile?.parents || []).map((p) => p?._id?.toString?.() || p?.toString?.()).filter(Boolean);
  } catch (err) {
    console.error("[Gamification] Failed to load profile for notifications:", err.message);
  }

  // Notify on level-up (student + parents)
  if (leveledUp && studentUserId) {
    emitToUser(studentUserId, "level:up", {
      newLevel: gamification.level,
      totalXP: gamification.xp,
    });

    try {
      await createNotificationService({
        recipient: studentUserId,
        type: "level_up",
        title: `🎉 Level Up! You're now Level ${gamification.level}!`,
        message: `You've reached ${gamification.xp} XP. Keep going!`,
        link: "/gamification",
      });

      await Promise.allSettled(
        parentIds.map((parentId) =>
          createNotificationService({
            recipient: parentId,
            type: "level_up",
            title: `🎉 ${studentName} reached Level ${gamification.level}!`,
            message: `${studentName} has reached ${gamification.xp} XP. Keep encouraging them!`,
            link: "/gamification",
          }),
        ),
      );
    } catch (err) {
      console.error("[Gamification] Level-up notification failed:", err.message);
    }
  }

  // Emit XP earned event + notify student and parents
  if (studentUserId) {
    emitToUser(studentUserId, "xp:earned", {
      amount,
      reason,
      totalXP: gamification.xp,
      level: gamification.level,
    });

    const reasonLabel = XP_REASON_LABELS[reason] || reason?.replace(/_/g, " ") || "your progress";

    try {
      await createNotificationService({
        recipient: studentUserId,
        type: "xp_earned",
        title: `⭐ You earned ${amount} XP!`,
        message: `You earned ${amount} XP for ${reasonLabel}. Total: ${gamification.xp} XP (Level ${gamification.level}).`,
        link: "/gamification",
      });

      await Promise.allSettled(
        parentIds.map((parentId) =>
          createNotificationService({
            recipient: parentId,
            type: "xp_earned",
            title: `⭐ ${studentName} earned ${amount} XP!`,
            message: `${studentName} earned ${amount} XP for ${reasonLabel}. Total: ${gamification.xp} XP (Level ${gamification.level}).`,
            link: "/gamification",
          }),
        ),
      );
    } catch (err) {
      console.error("[Gamification] XP notification failed:", err.message);
    }
  }

  return { gamification, leveledUp, newlyUnlockedBadges };
};

// ─── Session Attendance ──────────────────────────────────────────────────────
/**
 * Awards attendance XP for a completed, attended session. Safe to call on every
 * update: awardXP only pays once per session.
 */
export const awardSessionAttendanceXP = async (session) => {
  if (session?.status !== "completed" || session.StudentAttended !== true) return;
  const profileId = session.studentProfileId?._id || session.studentProfileId;
  if (!profileId) return;
  await awardXP(profileId, SESSION_ATTENDED_XP, "session_attended", session._id);
};

// ─── Get Profile Stats ───────────────────────────────────────────────────────
/**
 * Returns full gamification profile with badge count.
 */
export const getProfileStats = async (studentProfileId) => {
  const gamification = await ensureProfile(studentProfileId);

  const badgeCount = await StudentBadge.countDocuments({ studentProfileId });

  return {
    xp: gamification.xp,
    level: gamification.level,
    lifetimeXP: gamification.lifetimeXP,
    currentStreak: liveStreak(gamification),
    longestStreak: gamification.longestStreak,
    lastActivityDate: gamification.lastActivityDate,
    stats: gamification.stats,
    badgeCount,
    xpToNextLevel: XP_PER_LEVEL - (gamification.xp % XP_PER_LEVEL),
  };
};

// ─── Get XP History ──────────────────────────────────────────────────────────
export const getXPHistory = async (studentProfileId, queryString = {}) => {
  const { page, limit, skip } = boundedPagination(queryString);
  const gamification = await Gamification.findOne({ studentProfileId });
  const history = [...(gamification?.xpHistory || [])].sort((a, b) => b.awardedAt - a.awardedAt);

  return {
    total: history.length,
    page,
    limit,
    data: history.slice(skip, skip + limit),
  };
};

// ─── Get My Badges ───────────────────────────────────────────────────────────
export const getStudentBadges = async (studentProfileId) => {
  return StudentBadge.find({ studentProfileId }).sort({ unlockedAt: -1 });
};

// ─── Resolve Student Profile ID ──────────────────────────────────────────────
/**
 * For students: resolve their user ID to a studentProfileId.
 * For parents: the requested child, or their first child when none is named.
 */
export const resolveStudentProfileId = async (user, requestedProfileId) => {
  if (user.role === "student") {
    const profile = await StudentProfile.findOne({ user: user._id });
    if (!profile) throw new AppErrorHelper("Student profile not found", 404);
    return profile._id;
  }
  if (user.role === "parent") {
    if (requestedProfileId !== undefined) {
      const child = typeof requestedProfileId === "string" && mongoose.isValidObjectId(requestedProfileId) ? await StudentProfile.findOne({ _id: requestedProfileId, parents: user._id }) : null;
      if (!child) throw new AppErrorHelper("Not allowed to view this child's progress", 403);
      return child._id;
    }
    const childProfiles = await StudentProfile.find({ parents: user._id });
    if (!childProfiles.length) throw new AppErrorHelper("No children profiles found", 404);
    return childProfiles[0]._id;
  }
  throw new AppErrorHelper("Invalid role for this operation", 403);
};
