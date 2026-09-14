import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.setTimeout(60_000);

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_TOKEN_SECRET: "test-access-secret-at-least-32-chars",
  JWT_REFRESH_TOKEN_SECRET: "test-refresh-secret-at-least-32-chars",
  JWT_TOKEN_EXPIRES_IN: "1h",
  JWT_REFRESH_EXPIRES_IN: "7d",
  SALT_ROUNDS: "4",
  CLIENT_URL: "http://localhost:5173",
});

jest.unstable_mockModule("../Utilities/EmailHelper.js", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../Services/NotificationHelpers.js", () => ({
  getAdminIds: jest.fn().mockResolvedValue([]),
  getStudentRecipients: jest.fn().mockResolvedValue({ studentUserId: null, studentName: "Student", parentIds: [] }),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  notifyStudentAndParents: jest.fn().mockResolvedValue(undefined),
  notifyUsers: jest.fn().mockResolvedValue(undefined),
}));

let app;
let models;
let mongod;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
  const load = async (name) => (await import(`../Models/${name}.js`)).default;
  models = {
    User: await load("user"),
    StudentProfile: await load("studentProfile"),
    Task: await load("Task"),
    Exam: await load("exam"),
    Session: await load("Session"),
    Submission: await load("Submission"),
    Notification: await load("Notification"),
    Challenge: await load("Challenge"),
    ChallengeAttempt: await load("ChallengeAttempt"),
    Gamification: await load("Gamification"),
    Assignment: await load("StudentInstructorAssignment"),
    ExternalCourse: await load("externalCourse"),
    Course: await load("Course"),
    Lesson: await load("Lesson"),
    LessonProgress: await load("LessonProgress"),
  };
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

// ─── Seeding helpers ──────────────────────────────────────────────────────────
// Raw collection inserts keep each test focused on the authorization boundary
// rather than on every model's create-time validation.

const oid = () => new mongoose.Types.ObjectId();
const stamps = () => ({ createdAt: new Date(), updatedAt: new Date() });
let seq = 0;

const insert = async (model, doc) => {
  const _id = doc._id ?? oid();
  await model.collection.insertOne({ _id, ...stamps(), ...doc });
  return { _id, ...doc };
};

const createActor = async (role, overrides = {}) => {
  seq += 1;
  const _id = oid();
  await models.User.collection.insertOne({
    _id,
    FullName: `Audit ${role}`,
    UserName: `audit_${role}_${seq}`,
    Email: `audit.${role}.${seq}@example.com`,
    password: "unused-hash",
    role,
    isActive: true,
    emailVerified: true,
    approvalStatus: "approved",
    ...overrides,
    ...stamps(),
  });
  const token = jwt.sign({ id: _id.toString(), role }, process.env.JWT_TOKEN_SECRET, { expiresIn: "1h" });
  return { _id, role, token };
};

const createProfile = (student, parents = []) =>
  insert(models.StudentProfile, { user: student._id, parents: parents.map((p) => p._id), grade: "Grade 6" });

const assign = (instructor, profile) =>
  insert(models.Assignment, { studentProfileId: profile._id, instructorId: instructor._id, status: "active", assignedAt: new Date() });

const createSession = (profile, instructor) =>
  insert(models.Session, {
    title: "Audit session",
    description: "Audit session description",
    studentProfileId: profile._id,
    instructorId: instructor._id,
    date: new Date(),
    deletedAt: null,
  });

const createTask = async (profile, instructor) => {
  const session = await createSession(profile, instructor);
  return insert(models.Task, {
    title: "Audit task",
    description: "Audit task description",
    dueDate: new Date(Date.now() + 86_400_000),
    sessionId: session._id,
    studentProfileId: profile._id,
    instructorId: instructor._id,
    status: "Pending",
    deletedAt: null,
  });
};

const createExam = (profile, instructor) =>
  insert(models.Exam, {
    title: "Audit exam",
    totalMark: 100,
    passingMark: 50,
    score: 42,
    date: new Date(),
    createdBy: instructor._id,
    studentProfileId: profile._id,
  });

const createChallenge = (creator, extra = {}) =>
  insert(models.Challenge, {
    title: "Audit puzzle",
    description: "What is the secret word?",
    type: "puzzle",
    difficulty: "easy",
    puzzleData: { questionType: "fill_blank", correctAnswer: "SECRET-ANSWER-7f3a" },
    xpReward: 50,
    timeLimit: 0,
    createdBy: creator._id,
    isActive: true,
    tags: [],
    deletedAt: null,
    ...extra,
  });

const auth = (req, actor) => req.set("Authorization", `Bearer ${actor.token}`);
const get = (url, actor) => auth(request(app).get(url), actor);
const bodyOf = (res) => JSON.stringify(res.body);

// Two students with separate instructors — the minimum needed to prove a
// boundary exists between them.
const createTwoStudents = async () => {
  const [studentA, studentB, parentA, instructorA, instructorB] = await Promise.all([
    createActor("student"),
    createActor("student"),
    createActor("parent"),
    createActor("instructor"),
    createActor("instructor"),
  ]);
  const profileA = await createProfile(studentA, [parentA]);
  const profileB = await createProfile(studentB);
  await assign(instructorA, profileA);
  await assign(instructorB, profileB);
  return { studentA, studentB, parentA, instructorA, instructorB, profileA, profileB };
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Query-string filter overriding the ownership scope

   ApiFeatures.filter() hands the parsed query string to Query#find(), which
   MERGES it into the conditions a service already set. When the caller
   repeats the scoping key with a plain value, Mongoose replaces the scope
   with the caller's value — so "my tasks" becomes "any student's tasks".
   Each test first proves the caller's own record is visible (the control),
   then that a victim's record never is.
   ══════════════════════════════════════════════════════════════════════════ */
describe("Query-string filter cannot widen an ownership scope", () => {
  it("student cannot read another student's tasks via ?studentProfileId", async () => {
    const { studentA, instructorA, instructorB, profileA, profileB } = await createTwoStudents();
    const own = await createTask(profileA, instructorA);
    const victim = await createTask(profileB, instructorB);

    const control = await get("/api/v1/task/me", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/task/me?studentProfileId=${profileB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("parent cannot read a non-child's tasks via ?studentProfileId", async () => {
    const { parentA, instructorA, instructorB, profileA, profileB } = await createTwoStudents();
    const own = await createTask(profileA, instructorA);
    const victim = await createTask(profileB, instructorB);

    const control = await get("/api/v1/task/me", parentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/task/me?studentProfileId=${profileB._id}`, parentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("student cannot read another student's exams via ?studentProfileId", async () => {
    const { studentA, instructorA, instructorB, profileA, profileB } = await createTwoStudents();
    const own = await createExam(profileA, instructorA);
    const victim = await createExam(profileB, instructorB);

    const control = await get("/api/v1/exam/my-exams", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/exam/my-exams?studentProfileId=${profileB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("student cannot read another student's sessions via ?studentProfileId", async () => {
    const { studentA, instructorA, instructorB, profileA, profileB } = await createTwoStudents();
    const own = await createSession(profileA, instructorA);
    const victim = await createSession(profileB, instructorB);

    const control = await get("/api/v1/session/me", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/session/me?studentProfileId=${profileB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("user cannot read another user's notifications via ?recipient", async () => {
    const { studentA, studentB } = await createTwoStudents();
    const note = (recipient) =>
      insert(models.Notification, {
        recipient: recipient._id,
        type: "announcement",
        title: "Audit",
        message: "Audit notification",
        isRead: false,
      });
    const own = await note(studentA);
    const victim = await note(studentB);

    const control = await get("/api/v1/notifications", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/notifications?recipient=${studentB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("student cannot read another student's challenge attempts via ?studentProfileId", async () => {
    const { studentA, instructorA, profileA, profileB } = await createTwoStudents();
    const challengeOwn = await createChallenge(instructorA);
    const challengeVictim = await createChallenge(instructorA, { title: "Victim puzzle" });
    const attempt = (profile, challenge) =>
      insert(models.ChallengeAttempt, {
        challenge: challenge._id,
        studentProfileId: profile._id,
        status: "correct",
        xpEarned: 50,
      });
    const own = await attempt(profileA, challengeOwn);
    const victim = await attempt(profileB, challengeVictim);

    const control = await get("/api/v1/challenges/my-attempts", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/challenges/my-attempts?studentProfileId=${profileB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("student cannot pass the path check with their own id and swap the query to another student's submissions", async () => {
    const { studentA, instructorA, instructorB, profileA, profileB } = await createTwoStudents();
    const submission = async (profile, instructor) => {
      const task = await createTask(profile, instructor);
      return insert(models.Submission, {
        task: task._id,
        studentProfileId: profile._id,
        status: "Completed",
        Task_links: [],
        files: [],
      });
    };
    const own = await submission(profileA, instructorA);
    const victim = await submission(profileB, instructorB);

    const control = await get(`/api/v1/submission/student/${profileA._id}`, studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/submission/student/${profileA._id}?studentProfileId=${profileB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  it("instructor cannot read an unassigned student's tasks via ?instructorId&studentProfileId", async () => {
    const { instructorA, instructorB, profileA, profileB } = await createTwoStudents();
    const own = await createTask(profileA, instructorA);
    const victim = await createTask(profileB, instructorB);

    const control = await get("/api/v1/task", instructorA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/task?instructorId=${instructorB._id}&studentProfileId=${profileB._id}`, instructorA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });

  // Control: this service wraps its scope in $and, which Query#find() cannot
  // overwrite. It documents the safe pattern and guards against regressing it.
  it("external-course /my-course keeps its $and-wrapped scope", async () => {
    const { studentA, parentA, profileA, profileB } = await createTwoStudents();
    const course = (profile) =>
      insert(models.ExternalCourse, {
        teacher: "T",
        subject: "Maths",
        createdBy: parentA._id,
        studentProfileId: profile._id,
        color: "#123456",
      });
    const own = await course(profileA);
    const victim = await course(profileB);

    const control = await get("/api/v1/external-course/my-course", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain(own._id.toString());

    const attack = await get(`/api/v1/external-course/my-course?studentProfileId=${profileB._id}`, studentA);
    expect(bodyOf(attack)).not.toContain(victim._id.toString());
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2. Hidden-field disclosure

   puzzleData.correctAnswer is `select: false` so students never receive it.
   ApiFeatures.fields() forwards ?fields= verbatim to Query#select(), and the
   "+path" syntax is exactly how Mongoose force-includes a select:false path.
   ══════════════════════════════════════════════════════════════════════════ */
describe("Hidden fields stay hidden", () => {
  // In a query string "+" decodes to a space, so the first case arrives as a
  // plain inclusion — which exposes a select:false path just as "+path" does.
  it.each([
    ["+ decoded as a space", "?fields=+puzzleData.correctAnswer"],
    ["a literal %2B prefix", "?fields=%2BpuzzleData.correctAnswer"],
    ["the bare path name", "?fields=title,puzzleData.correctAnswer"],
    ["the parent path", "?fields=puzzleData"],
  ])("student cannot pull puzzle answers through ?fields= using %s", async (_label, query) => {
    const { studentA, instructorA } = await createTwoStudents();
    await createChallenge(instructorA);

    const control = await get("/api/v1/challenges", studentA);
    expect(control.status).toBe(200);
    expect(bodyOf(control)).toContain("Audit puzzle");
    expect(bodyOf(control)).not.toContain("SECRET-ANSWER-7f3a");

    const attack = await get(`/api/v1/challenges${query}`, studentA);
    expect(bodyOf(attack)).not.toContain("SECRET-ANSWER-7f3a");
  });

  // Sorting on a hidden path leaks its ordering even when the value itself is
  // never returned — enough to binary-search an answer across many challenges.
  it("student cannot order challenges by the hidden answer via ?sort=", async () => {
    const { studentA, instructorA } = await createTwoStudents();
    // Newest-first and answer-order disagree, so the result shows which one ran.
    await createChallenge(instructorA, {
      title: "Answer aaa, older",
      puzzleData: { questionType: "fill_blank", correctAnswer: "aaa" },
      createdAt: new Date(Date.now() - 60_000),
    });
    await createChallenge(instructorA, {
      title: "Answer zzz, newer",
      puzzleData: { questionType: "fill_blank", correctAnswer: "zzz" },
      createdAt: new Date(),
    });

    const res = await get("/api/v1/challenges?sort=puzzleData.correctAnswer", studentA);
    expect(res.status).toBe(200);
    // The hidden sort key is dropped, so the default newest-first order applies.
    expect(res.body.data.challenges.map((c) => c.title)).toEqual(["Answer zzz, newer", "Answer aaa, older"]);
  });

  it("student cannot pull puzzle answers from the challenge detail route", async () => {
    const { studentA, instructorA } = await createTwoStudents();
    const challenge = await createChallenge(instructorA);

    const res = await get(`/api/v1/challenges/${challenge._id}`, studentA);
    expect(res.status).toBe(200);
    expect(bodyOf(res)).not.toContain("SECRET-ANSWER-7f3a");
  });

  it("student cannot list deactivated challenges via ?isActive=false", async () => {
    const { studentA, instructorA } = await createTwoStudents();
    await createChallenge(instructorA, { title: "Retired puzzle", isActive: false });

    const res = await get("/api/v1/challenges?isActive=false", studentA);
    expect(bodyOf(res)).not.toContain("Retired puzzle");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3. Object-level authorization on direct ids
   ══════════════════════════════════════════════════════════════════════════ */
describe("Direct object references are scoped", () => {
  it("instructor cannot read an unassigned student's gamification profile", async () => {
    const { instructorA, profileB } = await createTwoStudents();
    await insert(models.Gamification, {
      studentProfileId: profileB._id,
      xp: 999,
      level: 10,
      lifetimeXP: 999,
      currentStreak: 3,
      longestStreak: 3,
      stats: {},
      xpHistory: [],
    });

    const res = await get(`/api/v1/gamification/${profileB._id}`, instructorA);
    expect([403, 404]).toContain(res.status);
  });

  it("student cannot attach a parent to their own profile", async () => {
    const { studentA, profileA } = await createTwoStudents();
    const stranger = await createActor("parent");

    await auth(request(app).patch(`/api/v1/StudentProfile/${profileA._id}`), studentA).send({
      parents: [stranger._id.toString()],
    });

    const stored = await models.StudentProfile.collection.findOne({ _id: profileA._id });
    expect(stored.parents.map(String)).not.toContain(stranger._id.toString());
  });

  it("parent cannot edit another family's child profile", async () => {
    const { parentA, profileB } = await createTwoStudents();

    const res = await auth(request(app).patch(`/api/v1/StudentProfile/${profileB._id}`), parentA).send({ grade: "Hacked" });
    expect([403, 404]).toContain(res.status);

    const stored = await models.StudentProfile.collection.findOne({ _id: profileB._id });
    expect(stored.grade).toBe("Grade 6");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4. Token handling
   ══════════════════════════════════════════════════════════════════════════ */
describe("Access tokens are verified strictly", () => {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const withToken = (token) => request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);

  it("rejects an unsigned alg:none token", async () => {
    const user = await createActor("student");
    const forged = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ id: user._id.toString(), role: "admin" })}.`;

    const res = await withToken(forged);
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const user = await createActor("student");
    const forged = jwt.sign({ id: user._id.toString(), role: "admin" }, "attacker-guessed-secret-value-xx", { expiresIn: "1h" });

    const res = await withToken(forged);
    expect(res.status).toBe(401);
  });

  it("rejects a refresh token presented as an access token", async () => {
    const user = await createActor("student");
    const refresh = jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

    const res = await withToken(refresh);
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const user = await createActor("student");
    const expired = jwt.sign(
      { id: user._id.toString(), role: "student", exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_TOKEN_SECRET,
    );

    const res = await withToken(expired);
    expect(res.status).toBe(401);
  });

  it("rejects a valid token once the account is deactivated", async () => {
    const user = await createActor("student", { isActive: false });

    const res = await withToken(user.token);
    expect(res.status).not.toBe(200);
  });

  it("rejects a valid token for an account still pending approval", async () => {
    const user = await createActor("student", { approvalStatus: "pending" });

    const res = await withToken(user.token);
    expect(res.status).toBe(403);
  });

  it("takes the role from the database, not from the token claim", async () => {
    const student = await createActor("student");
    const escalated = jwt.sign({ id: student._id.toString(), role: "admin" }, process.env.JWT_TOKEN_SECRET, { expiresIn: "1h" });

    const res = await request(app).get("/api/v1/user").set("Authorization", `Bearer ${escalated}`);
    expect(res.status).toBe(403);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   5. Input integrity
   ══════════════════════════════════════════════════════════════════════════ */
describe("Client-supplied scores are bounded", () => {
  const seedLesson = async () => {
    const student = await createActor("student");
    const profile = await createProfile(student);
    const course = await insert(models.Course, {
      title: `Audit course ${seq}`,
      description: "d",
      gradeLevel: "6",
      difficulty: "easy",
      tags: [],
      isActive: true,
      deletedAt: null,
    });
    const lesson = await insert(models.Lesson, {
      courseId: course._id,
      moduleTitle: "M1",
      title: "Audit lesson",
      order: 1,
      xpReward: 15,
      pages: [{ type: "mini_quiz", title: "Q", quizData: { question: "q?", options: ["a", "b"], correctAnswer: "a" } }],
      deletedAt: null,
    });
    return { student, profile, lesson };
  };

  it.each([[1000], [-5]])("rejects an out-of-range quizScore of %p without storing it", async (quizScore) => {
    const { student, profile, lesson } = await seedLesson();

    const res = await auth(request(app).post(`/api/v1/curriculum/lessons/${lesson._id}/complete`), student).send({ quizScore });
    expect(res.status).toBe(400);

    const stored = await models.LessonProgress.collection.findOne({ studentProfileId: profile._id });
    expect(stored?.quizScore ?? 0).toBeGreaterThanOrEqual(0);
    expect(stored?.quizScore ?? 0).toBeLessThanOrEqual(100);
  });
});
