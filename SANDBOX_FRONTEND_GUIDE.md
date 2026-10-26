# Code Sandbox — Frontend Guide

Students, instructors and admins write and run Python and JavaScript **in the
browser**. The backend never executes code. For graded work the browser runs the
code against every test input and sends back the raw stdout of each; the server
compares them with expected outputs (hidden ones are never sent to students) and
sets the score. Faking a pass means knowing the hidden answer.

## Test-case contract

- `input` is fed to the program as **stdin**.
- The server compares stdout after normalizing: `\r\n` → `\n`, trailing
  whitespace stripped from each line, trailing blank lines dropped
  (`normalizeOutput` in `Backend/Utilities/codeGrader.js` — mirror it on the client
  so visible-test pass/fail matches the server).
- Python `input("prompt")` prints its prompt to stdout like real Python; the UI
  should hint that graded programs should call `input()` without a message.

## API

### Task code exercises (new)

A task may carry an optional `codeExercise`. Tasks without one are unchanged.

Instructor/admin create (`POST /api/v1/task`, `POST /api/v1/task/bulk`) and edit
(`PATCH /api/v1/task/:id`):

```jsonc
"codeExercise": {
  "language": "python",            // "python" | "javascript"
  "starterCode": "",               // optional
  "testCases": [                   // 1–20
    { "input": "1 2", "expectedOutput": "3", "isHidden": false }
  ]
}
// PATCH with "codeExercise": null turns it back into a regular task
```

Staff reads (`GET /api/v1/task`, `/task/:id`, `/task/session/:id`,
`/task/student/:id`, PATCH response) include every test case.

Student/parent reads:
- `GET /api/v1/task/me` (list) — `codeExercise.language` + `starterCode`, **no** `testCases`.
- `GET /api/v1/task/me/:id` — `testCases` with every `input`; hidden cases are
  `{ input, isHidden: true }` with no `expectedOutput`.

Student submit (retry allowed until an instructor reviews it):

```
POST /api/v1/submission/task/:taskId/code
{ "code": "...", "outputs": ["3\n", "10\n", "..."] }   // one stdout per test case, in order
```

Response `data.submission.code`:
`{ language, source, passed, total, score (0-100), results: [bool per test], submittedAt }`.
The submission's `status` is `Completed` (or `Late submission`), `review.score` is
set automatically on the 0–10 scale, and the task becomes `completed` only when
every test passes. Errors: 400 wrong output count / not a code task / already
reviewed, 404 not your task, 403 non-student. `message` is a ready-to-show summary.

Submissions (`/api/v1/submission/...`, staff and `/me`) now carry the same `code`
object — show the source and pass/fail in the instructor's submission view.

### Coding challenges

- `codingData.language`: `"python" | "javascript"`; old challenges have none → treat as python.
  Instructor create/edit form needs a language select.
- Students: `GET /api/v1/challenges/:id` returns every test input; hidden ones have
  no `expectedOutput`. The list never contains `testCases` for students — fetch by id.
  Staff get every test case in both.
- `POST /api/v1/challenges/:id/submit-code` with
  `{ submittedCode, outputs: [...] }` (one per test case) → graded immediately:
  `attempt.status = "graded"`, `score` 0–100, `testResults { passed, total, results }`,
  `xpAwarded`. Without `outputs` it stays `pending` for manual grading (old behaviour).

## Runtime (already started)

Frontend worktree: `FrontEnd/.claude/worktrees/python-node-sandbox`
(branch `claude/python-node-sandbox`), uncommitted:

- `public/sandbox/sandbox-worker.js` — module worker. Message protocol is in its
  header comment. Python via Pyodide at `/sandbox/pyodide/`, JS via `AsyncFunction`
  with `console`, `input()/readline()/prompt()`, `require('fs').readFileSync(0)`,
  `require('readline').createInterface`, `process.stdout.write`. 64 KB output cap.
- `pyodide@314.0.7` added as an exact dependency.

Still needed for the runtime:

1. **Self-host Pyodide.** Production CSP is `script-src 'self'`; no CDN. Add a Vite
   plugin like `excalidrawAssetsPlugin` that copies `pyodide.mjs`, `pyodide.asm.mjs`,
   `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json` from
   `node_modules/pyodide` to `public/sandbox/pyodide/`, and gitignore that folder.
2. **CSP for the worker only.** In `vercel.json` add a header rule for
   `/sandbox/(.*)` (after the global one) whose CSP allows `'unsafe-eval'
   'wasm-unsafe-eval'` and `connect-src 'self'`. Do not loosen the app's CSP.
   `vite.config.js` already allows `worker-src 'self' blob:`.
3. **Main-thread client** (`src/utils/codeSandbox.js`): lazily `new Worker('/sandbox/sandbox-worker.js', { type: 'module' })`;
   run(language, code, inputs) → per-test `{ stdout, stderr, durationMs, timedOut }`;
   per-test timeout (~5 s, started on `test-start`, longer allowance while Python
   loads) → `worker.terminate()`, mark remaining tests timed out, recreate on next run.
   Export `normalizeOutput` identical to the backend.

## Security requirements (do not skip)

- The access token is in `localStorage` and refresh uses a cookie. The worker
  shares the origin, so it strips `fetch`, `XMLHttpRequest`, `WebSocket`, etc.
  **after** Pyodide loads and **before** any user code. Keep that ordering.
- Never run one user's code in another user's browser. Instructors see student
  code as read-only text (escaped by React) with the server's pass/fail — no
  "Run" button on student submissions.
- Only render worker output as text, never as HTML.

## UI to build

1. **`CodeSandbox` component** — code editor (textarea with line-number gutter,
   Tab inserts spaces, Ctrl/Cmd+Enter runs), language select or fixed badge, Run,
   optional stdin box, output panel (stdout/stderr), test list (visible: input,
   expected, got, pass/fail; hidden: "checked on submit"), Submit button that runs
   all inputs and calls `onSubmit({ code, outputs })`, then shows the server's
   per-test `results`. Use the app's existing `modal-*`, `nb-btn`, CSS variables.
2. **Playground page** `/dashboard/sandbox` for student, instructor and admin, with
   a "Code Sandbox" nav item in each of those role menus (`DashboardLayout.jsx`).
   Free run with custom stdin; remember the draft per language in `localStorage`
   (wrapped in try/catch).
3. **Tasks** (`TasksPage.jsx`): instructor create/edit/bulk form gets an optional
   "Code exercise" toggle (language, starter code, test-case rows with hidden
   checkbox); edit sends `null` when toggled off on a task that had one. Task cards
   show a language badge. Students get a "Solve" button on code tasks that opens the
   sandbox (fetch `/task/me/:id` for tests and their previous code from
   `/submission/me?task=<id>`), submit via the endpoint above, show the result,
   refresh the list.
4. **Submissions page**: show `submission.code` (language, passed/total, read-only source).
5. **Challenges**: student coding challenge uses `CodeSandbox` and submits `outputs`;
   instructor challenge form gets the language select.

## Verify

Run backend locally (in-memory Mongo or a local DB — never the production
`CONNECTION_STRING`) and the Vite dev server; as an instructor create a Python and a
JavaScript code task with a hidden test, then as the student solve each one wrong and
then right; check the playground for both roles, an infinite loop times out and the
next run still works, and `fetch` is undefined inside student code. Run
`npm test`, `npm run lint`, and `npm run build` (build needs `VITE_API_BASE`/`VITE_SOCKET_URL`).
