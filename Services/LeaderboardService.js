import Gamification from "../Models/Gamification.js";
import StudentProfile from "../Models/studentProfile.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import { boundedPagination, startOfYesterday } from "./GamificationService.js";

const PERIOD_DAYS = { weekly: 7, monthly: 30 };
const PERIODS = ["all_time", ...Object.keys(PERIOD_DAYS)];
const METRIC_SORT_FIELDS = { xp: "xp", challenges: "stats.challengesSolved", streak: "longestStreak" };

const assertOneOf = (name, value, allowed) => {
  if (!allowed.includes(value)) {
    throw new AppErrorHelper(`Invalid ${name}. Allowed values: ${allowed.join(", ")}`, 400);
  }
};

/**
 * Every ranked student, best first. Time-based periods always rank by XP
 * earned in the period; `metric` applies to all_time only.
 */
const rankStudents = async ({ period: requestedPeriod, metric: requestedMetric, grade } = {}) => {
  const period = requestedPeriod || "all_time";
  const metric = requestedMetric || "xp";
  assertOneOf("period", period, PERIODS);
  assertOneOf("metric", metric, Object.keys(METRIC_SORT_FIELDS));
  if (grade !== undefined && typeof grade !== "string") {
    throw new AppErrorHelper("Invalid grade", 400);
  }

  const timeBased = period !== "all_time";
  const sortField = timeBased ? "periodXP" : METRIC_SORT_FIELDS[metric];

  const pipeline = [{ $match: { xp: { $gt: 0 } } }];

  if (timeBased) {
    const since = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
    pipeline.push(
      {
        $addFields: {
          periodXP: {
            $reduce: {
              input: {
                $filter: {
                  input: "$xpHistory",
                  as: "entry",
                  cond: { $gte: ["$$entry.awardedAt", since] },
                },
              },
              initialValue: 0,
              in: { $add: ["$$value", "$$this.amount"] },
            },
          },
        },
      },
      { $match: { periodXP: { $gt: 0 } } },
    );
  }

  pipeline.push(
    {
      $lookup: {
        from: "studentprofiles",
        localField: "studentProfileId",
        foreignField: "_id",
        as: "profile",
      },
    },
    { $unwind: "$profile" },
  );

  if (grade) {
    pipeline.push({ $match: { "profile.grade": grade } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "profile.user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    // Only include active users
    { $match: { "user.isActive": { $ne: false } } },
    {
      $lookup: {
        from: "studentbadges",
        localField: "studentProfileId",
        foreignField: "studentProfileId",
        pipeline: [{ $count: "count" }],
        as: "badgeTotals",
      },
    },
    {
      $setWindowFields: {
        sortBy: { [sortField]: -1 },
        output: { rank: { $rank: {} } },
      },
    },
    { $sort: { rank: 1, _id: 1 } },
    {
      $project: {
        rank: 1,
        studentProfileId: 1,
        userId: "$user._id",
        studentName: "$user.FullName",
        userName: "$user.UserName",
        avatar: "$user.avatar",
        grade: "$profile.grade",
        xp: timeBased ? "$periodXP" : "$xp",
        level: 1,
        // The stored streak goes stale once a student stops earning XP.
        currentStreak: {
          $cond: [{ $gte: ["$lastActivityDate", startOfYesterday()] }, "$currentStreak", 0],
        },
        longestStreak: 1,
        challengesSolved: "$stats.challengesSolved",
        puzzlesSolved: "$stats.puzzlesSolved",
        badgeCount: { $ifNull: [{ $first: "$badgeTotals.count" }, 0] },
      },
    },
  );

  return Gamification.aggregate(pipeline);
};

const isUser = (userId) => (entry) => entry.userId && entry.userId.toString() === userId.toString();

/**
 * Build and execute the leaderboard aggregation pipeline.
 *
 * @param {Object} options
 * @param {string} [options.period]  - "weekly" | "monthly" | "all_time" (default)
 * @param {string} [options.metric]  - "xp" | "challenges" | "streak" (default: "xp")
 * @param {string} [options.grade]   - Filter by student grade
 * @param {number|string} [options.page]  - Page number (default: 1)
 * @param {number|string} [options.limit] - Results per page (default: 20, max: 100)
 * @param {string} [options.userId]  - Current user ID, for calculating "myRank"
 * @returns {{ leaderboard, myRank, totalStudents, page, limit }}
 */
export const getLeaderboardService = async (options = {}) => {
  const { page, limit, skip } = boundedPagination(options);
  const ranked = await rankStudents(options);

  return {
    leaderboard: ranked.slice(skip, skip + limit),
    myRank: options.userId ? ranked.find(isUser(options.userId))?.rank || null : null,
    totalStudents: ranked.length,
    page,
    limit,
  };
};

/**
 * Get just the current user's rank without the full leaderboard.
 */
export const getMyRankService = async (userId) => {
  const profile = await StudentProfile.findOne({ user: userId });
  if (!profile) throw new AppErrorHelper("Student profile not found", 404);

  const ranked = await rankStudents();
  const myEntry = ranked.find(isUser(userId));

  if (!myEntry) {
    return { rank: null, totalStudents: ranked.length, message: "No activity yet" };
  }

  return {
    ...myEntry,
    rank: myEntry.rank,
    totalStudents: ranked.length,
  };
};
