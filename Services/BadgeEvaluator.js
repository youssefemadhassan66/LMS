import { Badge, StudentBadge } from "../Models/Badge.js";
import Gamification, { levelForXP } from "../Models/Gamification.js";
import { createNotificationService } from "./NotificationService.js";
import StudentProfile from "../Models/studentProfile.js";
import { emitToUser } from "../Utilities/SocketManager.js";

const statValue = (gamification, stat) => {
  if (stat === "level") return gamification.level;
  if (stat === "currentStreak") return gamification.currentStreak;
  return gamification.stats?.[stat];
};

const notifyBadgeUnlocked = async (studentProfileId, badge) => {
  // Its own try/catch so a notification failure never undoes or hides an unlock.
  try {
    const profile = await StudentProfile.findById(studentProfileId);
    if (!profile?.user) return;

    const userId = profile.user._id?.toString?.() || profile.user.toString();
    const studentName = profile.user.FullName || "Your child";

    emitToUser(userId, "badge:unlocked", {
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity,
      description: badge.description,
      xpReward: badge.xpReward,
    });

    // Persist notification for the student
    await createNotificationService({
      recipient: userId,
      type: "badge_unlocked",
      title: `🏆 Badge Unlocked: ${badge.name}!`,
      message: `${badge.description} — You earned ${badge.xpReward} bonus XP!`,
      link: "/gamification/badges",
    });

    // Notify the parents too
    const parentIds = (profile.parents || []).map((p) => p?._id?.toString?.() || p?.toString?.()).filter(Boolean);

    await Promise.allSettled(
      parentIds.map((parentId) =>
        createNotificationService({
          recipient: parentId,
          type: "badge_unlocked",
          title: `🏆 ${studentName} unlocked a badge: ${badge.name}!`,
          message: `${badge.description}${badge.xpReward > 0 ? ` — ${studentName} earned ${badge.xpReward} bonus XP!` : ""}`,
          link: "/gamification/badges",
        }),
      ),
    );
  } catch (err) {
    console.error("[BadgeEvaluator] Badge unlock notification failed:", err.message);
  }
};

/**
 * Evaluate all badge conditions for a student and unlock any newly earned badges.
 * Called by GamificationService.awardXP() after every XP change.
 *
 * @param {string} studentProfileId
 * @returns {Array} Array of newly unlocked badge documents
 */
export const evaluateBadges = async (studentProfileId) => {
  const allBadges = await Badge.find({});
  const newlyUnlocked = [];

  // A badge's bonus XP can lift the level enough for a level badge, so keep
  // evaluating until a pass unlocks nothing. Each badge unlocks at most once,
  // which bounds the number of passes.
  for (let pass = 0; pass <= allBadges.length; pass += 1) {
    const gamification = await Gamification.findOne({ studentProfileId });
    if (!gamification) break;

    const earned = new Set((await StudentBadge.distinct("badge", { studentProfileId })).map(String));
    let unlockedThisPass = 0;

    for (const badge of allBadges) {
      if (earned.has(badge._id.toString())) continue;

      const currentValue = statValue(gamification, badge.condition.stat);
      if (currentValue === undefined || currentValue < badge.condition.threshold) continue;

      try {
        await StudentBadge.create({ studentProfileId, badge: badge._id });
      } catch (err) {
        // Duplicate key: a concurrent evaluation unlocked it (and paid its bonus).
        if (err.code !== 11000) {
          console.error(`[BadgeEvaluator] Failed to unlock badge "${badge.name}":`, err.message);
        }
        continue;
      }

      newlyUnlocked.push(badge);
      unlockedThisPass += 1;

      if (badge.xpReward > 0) {
        const updated = await Gamification.findOneAndUpdate(
          { _id: gamification._id },
          {
            $inc: { xp: badge.xpReward, lifetimeXP: badge.xpReward },
            $push: {
              xpHistory: { amount: badge.xpReward, reason: "badge_bonus", sourceId: badge._id, awardedAt: new Date() },
            },
          },
          { returnDocument: "after" },
        );
        await Gamification.updateOne({ _id: gamification._id }, { $max: { level: levelForXP(updated.xp) } });
      }

      await notifyBadgeUnlocked(studentProfileId, badge);
    }

    if (unlockedThisPass === 0) break;
  }

  return newlyUnlocked;
};
