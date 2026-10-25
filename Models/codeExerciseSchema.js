import mongoose from "mongoose";

// Languages the browser sandbox can run (Pyodide / Web Worker)
export const CODE_LANGUAGES = ["python", "javascript"];

// Shared by challenges and task code exercises. `input` is fed to the program
// as stdin; its stdout is compared with `expectedOutput`.
export const codeTestCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
  },
  { _id: false },
);
