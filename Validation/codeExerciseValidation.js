import Joi from "joi";
import { CODE_LANGUAGES } from "../Models/codeExerciseSchema.js";
import { MAX_OUTPUT_LENGTH, MAX_SOURCE_LENGTH, MAX_TEST_CASES } from "../Utilities/codeGrader.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";

const codeTestCaseSchema = Joi.object({
  input: Joi.string().allow("").max(10_000).default(""),
  expectedOutput: Joi.string().allow("").max(10_000).required(),
  isHidden: Joi.boolean().default(false),
});

// Optional code exercise attached to a task
export const codeExerciseSchema = Joi.object({
  language: Joi.string()
    .valid(...CODE_LANGUAGES)
    .required(),
  starterCode: Joi.string().allow("").max(MAX_SOURCE_LENGTH).default(""),
  testCases: Joi.array().items(codeTestCaseSchema).min(1).max(MAX_TEST_CASES).required(),
});

// What the browser sandbox sends back: the code and one stdout per test case
export const codeRunSubmissionSchema = Joi.object({
  code: Joi.string().min(1).max(MAX_SOURCE_LENGTH).required(),
  outputs: Joi.array().items(Joi.string().allow("").max(MAX_OUTPUT_LENGTH)).max(MAX_TEST_CASES).required(),
});

export const parseCodeExercise = (codeExercise) => {
  const { error, value } = codeExerciseSchema.validate(codeExercise, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppErrorHelper(`codeExercise: ${error.details.map((detail) => detail.message).join(", ")}`, 400);
  }
  return value;
};
