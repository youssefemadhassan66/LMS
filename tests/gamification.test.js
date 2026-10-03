import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import User from "../Models/user.js";
import StudentProfile from "../Models/studentProfile.js";
import Gamification from "../Models/Gamification.js";
import Session from "../Models/Session.js";
import { Badge, StudentBadge } from "../Models/Badge.js";

jest.setTimeout(30_000);

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_TOKEN_SECRET: "test-secret-32-characters-long!!",
  JWT_REFRESH_TOKEN_SECRET: "test-refresh-secret-32-characters!",
  JWT_TOKEN_EXPIRES_IN: "2h",
  JWT_REFRESH_EXPIRES_IN: "7d",
  SALT_ROUNDS: "4",
  CLIENT_URL: "http://localhost:5173",
});

const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD = "Password123!";

let mongod;
let app;
let awardXP;
let getProfileStats;
let getXPHistory;
let autoCompleteStaleSessionsService;

const createUser = (name, role) =>
  User.create({
    FullName: name,
    UserName: name.toLowerCase().replace(/\s+/g, ""),
    Email: `${name.toLowerCase().replace(/\s+/g, ".")}@test.com`,
    password: PASSWORD,
    role,
    emailVerified: true,
  });

const createStudent = async (name, grade = "Grade 6") => {
  const user = await createUser(name, "student");
  const profile = await StudentProfile.create({ user: user._id, grade });
  return { user, profile };
};

const login = async (user) => {
  const res = await request(app).post("/api/v1/auth/login").send({ email: user.Email, password: PASSWORD });
  return { token: res.body.data.token, cookie: res.headers["set-cookie"] };
};

const authed = (method, url, { token, cookie }) => request(app)[method](url).set("Cookie", cookie).set("Authorization", `Bearer ${token}`);

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
  ({ awardXP, getProfileStats, getXPHistory } = await import("../Services/GamificationService.js"));
  ({ autoCompleteStaleSessionsService } = await import("../Services/sessionService.js"));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User, StudentProfile, Gamification, Session, Badge, StudentBadge].map((model) => model.deleteMany({})));
});

describe("awardXP", () => {
  it("pays a source once per reason group, however often its hook fires", async () => {
    const { profile } = await createStudent("Reem Hassan");
    const submissionId = new mongoose.Types.ObjectId();

    await awardXP(profile._id, 20, "task_submit", submissionId);
    await awardXP(profile._id, 20, "task_submit", submissionId);
    await awardXP(profile._id, 5, "task_submit_late", submissionId);
    await awardXP(profile._id, 50, "review_perfect", submissionId);
    await awardXP(profile._id, 50, "review_perfect", submissionId);
    await awardXP(profile._id, 30, "review_excellent", submissionId);

    const gamification = await Gamification.findOne({ studentProfileId: profile._id });
    expect(gamification.xp).toBe(70);
    expect(gamification.stats.tasksSubmitted).toBe(1);
    expect(gamification.stats.tasksOnTime).toBe(1);
    expect(gamification.stats.perfectScores).toBe(1);
    expect(gamification.xpHistory.map((entry) => entry.reason)).toEqual(["task_submit", "review_perfect"]);
  });

  it("keeps every concurrent award", async () => {
    const { profile } = await createStudent("Reem Hassan");

    await Promise.all(Array.from({ length: 8 }, () => awardXP(profile._id, 10, "puzzle_solved", new mongoose.Types.ObjectId())));

    const gamification = await Gamification.findOne({ studentProfileId: profile._id });
    expect(gamification.xp).toBe(80);
    expect(gamification.lifetimeXP).toBe(80);
    expect(gamification.stats.puzzlesSolved).toBe(8);
    expect(gamification.xpHistory).toHaveLength(8);
  });

  it("rejects reasons outside the history enum", async () => {
    const { profile } = await createStudent("Reem Hassan");
    await expect(awardXP(profile._id, 10, "made_up")).rejects.toThrow("Unknown XP reason");
  });

  it("counts badge bonus XP toward the level, the level-up, and level badges", async () => {
    const { profile } = await createStudent("Reem Hassan");
    await Badge.create([
      {
        name: "First Blood",
        description: "Submit your first task",
        category: "submission",
        condition: { stat: "tasksSubmitted", threshold: 1 },
        xpReward: 25,
      },
      {
        name: "Level 2",
        description: "Reach Level 2",
        category: "general",
        condition: { stat: "level", threshold: 2 },
        xpReward: 0,
      },
    ]);

    const result = await awardXP(profile._id, 80, "task_submit", new mongoose.Types.ObjectId());

    expect(result.newlyUnlockedBadges.map((badge) => badge.name).sort()).toEqual(["First Blood", "Level 2"]);
    expect(result.leveledUp).toBe(true);
    expect(result.gamification.xp).toBe(105);
    expect(result.gamification.level).toBe(2);
    expect(await StudentBadge.countDocuments({ studentProfileId: profile._id })).toBe(2);
  });
});

describe("streaks", () => {
  it("extends on consecutive days and restarts after a gap", async () => {
    const { profile } = await createStudent("Reem Hassan");
    await Gamification.create({
      studentProfileId: profile._id,
      currentStreak: 4,
      longestStreak: 4,
      lastActivityDate: new Date(Date.now() - DAY_MS),
    });

    await awardXP(profile._id, 10, "puzzle_solved", new mongoose.Types.ObjectId());
    let gamification = await Gamification.findOne({ studentProfileId: profile._id });
    expect(gamification.currentStreak).toBe(5);
    expect(gamification.longestStreak).toBe(5);

    await Gamification.updateOne({ _id: gamification._id }, { lastActivityDate: new Date(Date.now() - 3 * DAY_MS) });
    await awardXP(profile._id, 10, "puzzle_solved", new mongoose.Types.ObjectId());
    gamification = await Gamification.findOne({ studentProfileId: profile._id });
    expect(gamification.currentStreak).toBe(1);
    expect(gamification.longestStreak).toBe(5);
  });

  it("reports a lapsed streak as 0 before the next award resets it", async () => {
    const { profile } = await createStudent("Reem Hassan");
    await Gamification.create({
      studentProfileId: profile._id,
      xp: 50,
      currentStreak: 6,
      longestStreak: 6,
      lastActivityDate: new Date(Date.now() - 3 * DAY_MS),
    });

    const stats = await getProfileStats(profile._id);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(6);
  });
});

describe("session attendance XP", () => {
  it("is awarded once when the scheduler auto-completes a session", async () => {
    const { profile } = await createStudent("Reem Hassan");
    const instructor = await createUser("Ahmed Teacher", "instructor");
    // Raw insert: Session's pre-save hook rejects past dates for new sessions.
    const { insertedId } = await Session.collection.insertOne({
      title: "Coding Lab",
      description: "Past session",
      studentProfileId: profile._id,
      instructorId: instructor._id,
      date: new Date(Date.now() - 3 * 60 * 60 * 1000),
      StudentAttended: true,
      status: "pending",
      deletedAt: null,
    });

    expect(await autoCompleteStaleSessionsService()).toBe(1);
    expect(await autoCompleteStaleSessionsService()).toBe(0);

    // A later save of the completed session must not pay again.
    const session = await Session.findById(insertedId);
    session.summary = "Went well";
    await session.save();

    const gamification = await Gamification.findOne({ studentProfileId: profile._id });
    expect(gamification.xp).toBe(15);
    expect(gamification.stats.sessionsAttended).toBe(1);
  });
});

describe("XP history", () => {
  it("returns the paged shape even before any XP and caps the page size", async () => {
    const { profile } = await createStudent("Reem Hassan");

    expect(await getXPHistory(profile._id, {})).toEqual({ total: 0, page: 1, limit: 20, data: [] });
    expect((await getXPHistory(profile._id, { limit: "5000", page: "-3" })).limit).toBe(100);
    expect((await getXPHistory(profile._id, { page: "-3" })).page).toBe(1);
  });
});

describe("leaderboard endpoints", () => {
  it("ranks students, bounds the page size, and rejects unknown periods", async () => {
    const reem = await createStudent("Reem Hassan");
    const laila = await createStudent("Laila Hassan");
    await awardXP(reem.profile._id, 40, "puzzle_solved", new mongoose.Types.ObjectId());
    await awardXP(laila.profile._id, 90, "puzzle_solved", new mongoose.Types.ObjectId());
    const auth = await login(reem.user);

    const board = await authed("get", "/api/v1/leaderboard?limit=5000", auth);
    expect(board.status).toBe(200);
    expect(board.body.limit).toBe(100);
    expect(board.body.leaderboard.map((entry) => [entry.studentName, entry.rank, entry.badgeCount])).toEqual([
      ["Laila Hassan", 1, 0],
      ["Reem Hassan", 2, 0],
    ]);
    expect(board.body.myRank).toBe(2);

    const weekly = await authed("get", "/api/v1/leaderboard?period=weekly", auth);
    expect(weekly.status).toBe(200);
    expect(weekly.body.totalStudents).toBe(2);

    const bad = await authed("get", "/api/v1/leaderboard?period=daily", auth);
    expect(bad.status).toBe(400);

    const myRank = await authed("get", "/api/v1/leaderboard/my-rank", auth);
    expect(myRank.status).toBe(200);
    expect(myRank.body.data).toMatchObject({ rank: 2, totalStudents: 2, xp: 40 });
  });
});

describe("parent gamification access", () => {
  it("lets a parent pick any of their children and nobody else's", async () => {
    const parent = await createUser("Emad Hassan", "parent");
    const first = await createStudent("Reem Hassan");
    const second = await createStudent("Laila Hassan");
    const stranger = await createStudent("Omar Said");
    await StudentProfile.updateMany({ _id: { $in: [first.profile._id, second.profile._id] } }, { $set: { parents: [parent._id] } });
    await awardXP(second.profile._id, 30, "puzzle_solved", new mongoose.Types.ObjectId());
    const auth = await login(parent);

    const defaultChild = await authed("get", "/api/v1/gamification/me", auth);
    expect(defaultChild.status).toBe(200);

    const chosen = await authed("get", `/api/v1/gamification/me?studentProfileId=${second.profile._id}`, auth);
    expect(chosen.status).toBe(200);
    expect(chosen.body.data.xp).toBe(30);

    const history = await authed("get", `/api/v1/gamification/me/history?studentProfileId=${second.profile._id}`, auth);
    expect(history.status).toBe(200);
    expect(history.body.total).toBe(1);

    const notMine = await authed("get", `/api/v1/gamification/me?studentProfileId=${stranger.profile._id}`, auth);
    expect(notMine.status).toBe(403);

    const garbage = await authed("get", "/api/v1/gamification/me?studentProfileId=not-an-id", auth);
    expect(garbage.status).toBe(403);
  });
});
