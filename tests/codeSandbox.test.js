import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { gradeOutputs, normalizeOutput, testCasesForStudent } from "../Utilities/codeGrader.js";

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

jest.unstable_mockModule("../Services/NotificationHelpers.js", () => ({
  getAdminIds: jest.fn().mockResolvedValue([]),
  getStudentRecipients: jest.fn().mockResolvedValue({ studentUserId: null, studentName: "Student", parentIds: [] }),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  notifyStudentAndParents: jest.fn().mockResolvedValue(undefined),
  notifyUsers: jest.fn().mockResolvedValue(undefined),
}));

const HIDDEN_OUTPUT = "HIDDEN-OUTPUT-9c1e";

let app;
let models;
let mongod;

beforeAll(async () => {
  ({ default: app } = await import("../App.js"));
  const load = async (name) => (await import(`../Models/${name}.js`)).default;
  models = {
    User: await load("user"),
    StudentProfile: await load("studentProfile"),
    Challenge: await load("Challenge"),
    ChallengeAttempt: await load("ChallengeAttempt"),
    Session: await load("Session"),
    Task: await load("Task"),
    Submission: await load("Submission"),
    Gamification: await load("Gamification"),
    Assignment: await load("StudentInstructorAssignment"),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const oid = () => new mongoose.Types.ObjectId();
let seq = 0;

const createActor = async (role) => {
  seq += 1;
  const _id = oid();
  await models.User.collection.insertOne({
    _id,
    FullName: `Sandbox ${role} ${seq}`,
    UserName: `sandbox_${role}_${seq}`,
    Email: `sandbox.${role}.${seq}@example.com`,
    password: "unused-hash",
    role,
    isActive: true,
    emailVerified: true,
    approvalStatus: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const token = jwt.sign({ id: _id.toString(), role }, process.env.JWT_TOKEN_SECRET, { expiresIn: "1h" });
  const actor = { _id, role, token };
  if (role === "student") {
    actor.profileId = oid();
    await models.StudentProfile.collection.insertOne({ _id: actor.profileId, user: _id, parents: [], grade: "Grade 6" });
  }
  return actor;
};

const as = (actor, req) => req.set("Authorization", `Bearer ${actor.token}`);
const api = {
  get: (actor, url) => as(actor, request(app).get(url)),
  post: (actor, url, body) => as(actor, request(app).post(url)).send(body),
  patch: (actor, url, body) => as(actor, request(app).patch(url)).send(body),
};

const testCases = [
  { input: "1 2", expectedOutput: "3" },
  { input: "5 5", expectedOutput: "10" },
  { input: "400 -1", expectedOutput: HIDDEN_OUTPUT, isHidden: true },
];

// ─── Grader ───────────────────────────────────────────────────────────────────

describe("code grader", () => {
  it("ignores line endings and trailing whitespace, nothing else", () => {
    expect(normalizeOutput("a  \r\nb\r\n\r\n")).toBe("a\nb");
    expect(normalizeOutput("  a")).toBe("  a");
    expect(normalizeOutput(undefined)).toBe("");
  });

  it("scores passes against every test case", () => {
    expect(gradeOutputs(testCases, ["3\n", "11", HIDDEN_OUTPUT])).toEqual({ passed: 2, total: 3, score: 67, results: [true, false, true] });
  });

  it("gives students hidden inputs without hidden expected outputs", () => {
    expect(testCasesForStudent(testCases)[2]).toEqual({ input: "400 -1", isHidden: true });
  });
});

// ─── Challenges ───────────────────────────────────────────────────────────────

const createCodingChallenge = (instructor) =>
  models.Challenge.create({
    title: "Add two numbers",
    description: "Read two numbers from stdin and print their sum.",
    type: "coding",
    difficulty: "easy",
    codingData: { language: "python", starterCode: "a, b = map(int, input().split())\n", testCases },
    xpReward: 50,
    createdBy: instructor._id,
  });

describe("challenge test-case visibility", () => {
  it("gives students every input but only visible expected outputs", async () => {
    const [instructor, student] = await Promise.all([createActor("instructor"), createActor("student")]);
    const challenge = await createCodingChallenge(instructor);

    const res = await api.get(student, `/api/v1/challenges/${challenge._id}`);

    expect(res.status).toBe(200);
    const { codingData } = res.body.data.challenge;
    expect(codingData.language).toBe("python");
    expect(codingData.testCases).toEqual(testCasesForStudent(testCases));
    expect(JSON.stringify(res.body)).not.toContain(HIDDEN_OUTPUT);
  });

  it("gives instructors every test case, in the list as well", async () => {
    const instructor = await createActor("instructor");
    const challenge = await createCodingChallenge(instructor);

    const one = await api.get(instructor, `/api/v1/challenges/${challenge._id}`);
    const list = await api.get(instructor, "/api/v1/challenges");

    expect(one.body.data.challenge.codingData.testCases).toHaveLength(3);
    expect(list.body.data.challenges[0].codingData.testCases).toHaveLength(3);
  });

  it("keeps test cases out of the student list and out of reach of ?filter, ?fields and ?sort", async () => {
    const [instructor, student] = await Promise.all([createActor("instructor"), createActor("student")]);
    await createCodingChallenge(instructor);

    const probes = [
      "/api/v1/challenges",
      "/api/v1/challenges?fields=codingData.testCases",
      "/api/v1/challenges?fields=codingData",
      "/api/v1/challenges?sort=codingData.testCases.expectedOutput",
      "/api/v1/challenges?codingData.testCases.expectedOutput=wrong-guess",
    ];

    for (const url of probes) {
      const res = await api.get(student, url);
      expect(res.status).toBe(200);
      // A filter that reached the field would turn a wrong guess into zero results.
      expect(res.body.results).toBe(1);
      expect(JSON.stringify(res.body)).not.toContain(HIDDEN_OUTPUT);
    }
  });

  it("accepts python and javascript and rejects anything else", async () => {
    const instructor = await createActor("instructor");
    const body = (language) => ({
      title: "Echo",
      description: "Print what you read from stdin.",
      type: "coding",
      difficulty: "easy",
      codingData: { language, testCases: [{ input: "hi", expectedOutput: "hi" }] },
      xpReward: 10,
    });

    const js = await api.post(instructor, "/api/v1/challenges", body("javascript"));
    expect(js.status).toBe(201);
    expect(js.body.data.challenge.codingData.language).toBe("javascript");

    const ruby = await api.post(instructor, "/api/v1/challenges", body("ruby"));
    expect(ruby.status).toBe(400);
  });
});

describe("coding challenge submission", () => {
  const startAndSubmit = async (student, challenge, body) => {
    await api.post(student, `/api/v1/challenges/${challenge._id}/start`);
    return api.post(student, `/api/v1/challenges/${challenge._id}/submit-code`, body);
  };

  it("auto-grades sandbox outputs against hidden cases and pays proportional XP", async () => {
    const [instructor, student] = await Promise.all([createActor("instructor"), createActor("student")]);
    const challenge = await createCodingChallenge(instructor);

    const res = await startAndSubmit(student, challenge, {
      submittedCode: "a, b = map(int, input().split())\nprint(a + b)\n",
      outputs: ["3", "10", "399"],
    });

    expect(res.status).toBe(200);
    const attempt = await models.ChallengeAttempt.findById(res.body.data.attempt._id);
    expect(attempt.status).toBe("graded");
    expect(attempt.score).toBe(67);
    expect(attempt.testResults.toObject()).toEqual({ passed: 2, total: 3, results: [true, true, false] });
    expect(attempt.xpAwarded).toBe(33);
    const gamification = await models.Gamification.findOne({ studentProfileId: student.profileId });
    expect(gamification.xp).toBe(33);
  });

  it("rejects an output count that does not match the test cases", async () => {
    const [instructor, student] = await Promise.all([createActor("instructor"), createActor("student")]);
    const challenge = await createCodingChallenge(instructor);

    const res = await startAndSubmit(student, challenge, { submittedCode: "print(3)", outputs: ["3", "10"] });

    expect(res.status).toBe(400);
  });

  it("still waits for an instructor when no outputs are sent", async () => {
    const [instructor, student] = await Promise.all([createActor("instructor"), createActor("student")]);
    const challenge = await createCodingChallenge(instructor);

    const res = await startAndSubmit(student, challenge, { submittedCode: "print(3)" });

    expect(res.status).toBe(200);
    expect(res.body.data.attempt.status).toBe("pending");
  });
});

// ─── Task code exercises ──────────────────────────────────────────────────────

const setupTaskActors = async () => {
  const [instructor, student, otherStudent] = await Promise.all([createActor("instructor"), createActor("student"), createActor("student")]);
  const sessionId = oid();
  await models.Session.collection.insertOne({
    _id: sessionId,
    title: "Loops",
    description: "Loops session",
    studentProfileId: student.profileId,
    instructorId: instructor._id,
    date: new Date(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await models.Assignment.collection.insertOne({ studentProfileId: student.profileId, instructorId: instructor._id, status: "active", assignedAt: new Date() });
  return { instructor, student, otherStudent, sessionId };
};

const createCodeTask = (instructor, sessionId, student, extra = {}) =>
  api.post(instructor, "/api/v1/task", {
    title: "Sum two numbers",
    description: "Read two numbers and print their sum.",
    dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    sessionId: sessionId.toString(),
    studentProfileId: student.profileId.toString(),
    codeExercise: { language: "python", starterCode: "a, b = map(int, input().split())\n", testCases },
    ...extra,
  });

describe("task code exercises", () => {
  it("lets an instructor attach a code exercise and see every test case", async () => {
    const { instructor, student, sessionId } = await setupTaskActors();

    const created = await createCodeTask(instructor, sessionId, student);
    expect(created.status).toBe(201);
    const taskId = created.body.data.task._id;

    const one = await api.get(instructor, `/api/v1/task/${taskId}`);
    expect(one.body.data.task.codeExercise.testCases).toHaveLength(3);

    const list = await api.get(instructor, "/api/v1/task");
    expect(list.body.data.tasks[0].codeExercise.testCases).toHaveLength(3);
  });

  it("rejects an invalid code exercise and leaves regular tasks untouched", async () => {
    const { instructor, student, sessionId } = await setupTaskActors();

    const bad = await createCodeTask(instructor, sessionId, student, { codeExercise: { language: "ruby", testCases } });
    expect(bad.status).toBe(400);

    const plain = await createCodeTask(instructor, sessionId, student, { codeExercise: undefined });
    expect(plain.status).toBe(201);
    expect(plain.body.data.task.codeExercise).toBeUndefined();
  });

  it("lets an instructor change the code exercise or remove it", async () => {
    const { instructor, student, sessionId } = await setupTaskActors();
    const created = await createCodeTask(instructor, sessionId, student);
    const taskId = created.body.data.task._id;

    const changed = await api.patch(instructor, `/api/v1/task/${taskId}`, {
      title: "Sum it",
      codeExercise: { language: "javascript", testCases: [{ input: "", expectedOutput: "hi" }] },
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.tasks.title).toBe("Sum it");
    expect(changed.body.data.tasks.codeExercise.language).toBe("javascript");
    expect(changed.body.data.tasks.codeExercise.testCases).toHaveLength(1);

    const removed = await api.patch(instructor, `/api/v1/task/${taskId}`, { codeExercise: null });
    expect(removed.status).toBe(200);
    expect(removed.body.data.tasks.codeExercise).toBeUndefined();
  });

  it("gives the student every input but no hidden expected output", async () => {
    const { instructor, student, sessionId } = await setupTaskActors();
    const created = await createCodeTask(instructor, sessionId, student);
    const taskId = created.body.data.task._id;

    const one = await api.get(student, `/api/v1/task/me/${taskId}`);
    expect(one.status).toBe(200);
    expect(one.body.data.task.codeExercise.testCases).toEqual(testCasesForStudent(testCases));
    expect(JSON.stringify(one.body)).not.toContain(HIDDEN_OUTPUT);

    const list = await api.get(student, "/api/v1/task/me");
    expect(list.body.data.tasks[0].codeExercise.language).toBe("python");
    expect(JSON.stringify(list.body)).not.toContain(HIDDEN_OUTPUT);
  });

  it("auto-grades a wrong answer, keeps the task open, then completes it on a correct retry", async () => {
    const { instructor, student, sessionId } = await setupTaskActors();
    const created = await createCodeTask(instructor, sessionId, student);
    const taskId = created.body.data.task._id;
    const submitCode = (outputs) => api.post(student, `/api/v1/submission/task/${taskId}/code`, { code: "print(sum(map(int, input().split())))", outputs });

    const wrong = await submitCode(["3", "10", "0"]);
    expect(wrong.status).toBe(200);
    expect(wrong.body.data.submission.code).toMatchObject({ language: "python", passed: 2, total: 3, score: 67, results: [true, true, false] });
    expect(wrong.body.data.submission.status).toBe("Completed");
    expect((await models.Task.findById(taskId)).status).toBe("pending");

    const right = await submitCode(["3", "10", HIDDEN_OUTPUT]);
    expect(right.status).toBe(200);
    expect(right.body.data.submission._id).toBe(wrong.body.data.submission._id);
    expect(right.body.data.submission.code).toMatchObject({ passed: 3, total: 3, score: 100 });
    expect(right.body.data.submission.review).toMatchObject({ score: 10, rating: "Full mark" });
    expect((await models.Task.findById(taskId)).status).toBe("completed");
    expect(await models.Submission.countDocuments({ task: taskId })).toBe(1);

    // The instructor sees the code and its result alongside the submission
    const forInstructor = await api.get(instructor, `/api/v1/submission/task/${taskId}`);
    expect(JSON.stringify(forInstructor.body)).toContain("print(sum(map(int, input().split())))");
  });

  it("stops retries once the instructor has reviewed the submission", async () => {
    const { instructor, student, sessionId } = await setupTaskActors();
    const created = await createCodeTask(instructor, sessionId, student);
    const taskId = created.body.data.task._id;
    const submitted = await api.post(student, `/api/v1/submission/task/${taskId}/code`, { code: "print(3)", outputs: ["3", "3", "3"] });

    const review = await api.patch(instructor, `/api/v1/submission/${submitted.body.data.submission._id}/review`, { score: 4, comment: "Hard-coded" });
    expect(review.status).toBe(200);

    const retry = await api.post(student, `/api/v1/submission/task/${taskId}/code`, { code: "print(a+b)", outputs: ["3", "10", HIDDEN_OUTPUT] });
    expect(retry.status).toBe(400);
  });

  it("refuses mismatched outputs, other students, and regular tasks", async () => {
    const { instructor, student, otherStudent, sessionId } = await setupTaskActors();
    const created = await createCodeTask(instructor, sessionId, student);
    const taskId = created.body.data.task._id;
    const plain = await createCodeTask(instructor, sessionId, student, { codeExercise: undefined });

    const mismatched = await api.post(student, `/api/v1/submission/task/${taskId}/code`, { code: "print(3)", outputs: ["3"] });
    expect(mismatched.status).toBe(400);

    const stranger = await api.post(otherStudent, `/api/v1/submission/task/${taskId}/code`, { code: "print(3)", outputs: ["3", "10", HIDDEN_OUTPUT] });
    expect(stranger.status).toBe(404);

    const regular = await api.post(student, `/api/v1/submission/task/${plain.body.data.task._id}/code`, { code: "print(3)", outputs: [] });
    expect(regular.status).toBe(400);

    const byInstructor = await api.post(instructor, `/api/v1/submission/task/${taskId}/code`, { code: "print(3)", outputs: ["3", "10", HIDDEN_OUTPUT] });
    expect(byInstructor.status).toBe(403);
  });
});
