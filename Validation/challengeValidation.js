import Joi from "joi";
import { CODE_LANGUAGES } from "../Models/codeExerciseSchema.js";
import { MAX_OUTPUT_LENGTH, MAX_TEST_CASES } from "../Utilities/codeGrader.js";

// ─── Create Challenge ─────────────────────────────────────────────────────────
export const createChallengeSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().min(10).required(),
  type: Joi.string().valid("coding", "puzzle").required(),
  difficulty: Joi.string().valid("easy", "medium", "hard").required(),

  puzzleData: Joi.when("type", {
    is: "puzzle",
    then: Joi.object({
      questionType: Joi.string().valid("multiple_choice", "fill_blank").required(),
      options: Joi.when("questionType", {
        is: "multiple_choice",
        then: Joi.array().items(Joi.string().trim()).min(2).max(6).required(),
        otherwise: Joi.forbidden(),
      }),
      correctAnswer: Joi.string().required(),
    }).required(),
    otherwise: Joi.forbidden(),
  }),

  codingData: Joi.when("type", {
    is: "coding",
    then: Joi.object({
      language: Joi.string()
        .valid(...CODE_LANGUAGES)
        .default("python"),
      starterCode: Joi.string().allow(""),
      hints: Joi.array().items(Joi.string()).max(5).default([]),
      testCases: Joi.array()
        .items(
          Joi.object({
            input: Joi.string().required(),
            expectedOutput: Joi.string().required(),
            isHidden: Joi.boolean().default(false),
          }),
        )
        .min(1)
        .required(),
    }).required(),
    otherwise: Joi.forbidden(),
  }),

  xpReward: Joi.number().integer().min(1).max(500).required(),
  timeLimit: Joi.number().integer().min(0).max(180).default(0),
  tags: Joi.array().items(Joi.string().trim().lowercase().max(30)).max(10).default([]),
  isActive: Joi.boolean().default(true),
});

// ─── Update Challenge ─────────────────────────────────────────────────────────
export const updateChallengeSchema = Joi.object({
  title: Joi.string().min(3).max(200),
  description: Joi.string().min(10),
  difficulty: Joi.string().valid("easy", "medium", "hard"),
  xpReward: Joi.number().integer().min(1).max(500),
  timeLimit: Joi.number().integer().min(0).max(180),
  tags: Joi.array().items(Joi.string().trim().lowercase().max(30)).max(10),
  isActive: Joi.boolean(),
  // Type-specific fields can be partially updated
  puzzleData: Joi.object({
    questionType: Joi.string().valid("multiple_choice", "fill_blank"),
    options: Joi.array().items(Joi.string().trim()).min(2).max(6),
    correctAnswer: Joi.string(),
  }),
  codingData: Joi.object({
    language: Joi.string().valid(...CODE_LANGUAGES),
    starterCode: Joi.string().allow(""),
    hints: Joi.array().items(Joi.string()).max(5),
    testCases: Joi.array()
      .items(
        Joi.object({
          input: Joi.string().required(),
          expectedOutput: Joi.string().required(),
          isHidden: Joi.boolean().default(false),
        }),
      )
      .min(1),
  }),
}).min(1);

// ─── Submit Puzzle Answer ─────────────────────────────────────────────────────
export const submitPuzzleSchema = Joi.object({
  selectedAnswer: Joi.string().required(),
});

// ─── Submit Coding Challenge ──────────────────────────────────────────────────
export const submitCodingSchema = Joi.object({
  submittedCode: Joi.string().allow(""),
  codeLinks: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required(),
      }),
    )
    .max(5),
  hintsUsed: Joi.number().integer().min(0),
  // stdout of each test case from the browser sandbox; when present the
  // attempt is graded automatically instead of waiting for an instructor
  outputs: Joi.array().items(Joi.string().allow("").max(MAX_OUTPUT_LENGTH)).max(MAX_TEST_CASES),
});

// ─── Grade Coding Challenge ──────────────────────────────────────────────────
export const gradeCodingSchema = Joi.object({
  score: Joi.number().integer().min(0).max(100).required(),
  feedback: Joi.string().max(2000).allow(""),
});
