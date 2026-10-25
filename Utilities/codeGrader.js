// Student code runs in the browser sandbox; the browser sends back the raw
// stdout of each test case and the server compares it with expected outputs it
// never revealed for hidden cases. Faking a pass means knowing the answer.

export const MAX_TEST_CASES = 20;
export const MAX_OUTPUT_LENGTH = 64 * 1024;
export const MAX_SOURCE_LENGTH = 50 * 1024;

// Line endings and trailing whitespace are not part of the answer.
export const normalizeOutput = (text) =>
  String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");

export const gradeOutputs = (testCases, outputs) => {
  const results = testCases.map((testCase, index) => normalizeOutput(outputs[index]) === normalizeOutput(testCase.expectedOutput));
  const passed = results.filter(Boolean).length;
  const total = testCases.length;

  return { passed, total, score: total ? Math.round((passed / total) * 100) : 0, results };
};

// Students need every input to run their code, but only visible expected outputs.
export const testCasesForStudent = (testCases = []) => testCases.map(({ input, expectedOutput, isHidden }) => (isHidden ? { input, isHidden: true } : { input, expectedOutput, isHidden: false }));
