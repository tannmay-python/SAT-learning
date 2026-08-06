# SATLAS

SATLAS is a private, local SAT learning hub with a continuously updated Gemini
learner model. The browser is only the interface. The canonical learning record
lives as readable files in [`data`](./data).

It is an independent study tool, not affiliated with or endorsed by College
Board. Its questions are original and it does not reproduce released items.

## Run it

Requirements:

- Node.js 22 or later
- Antigravity CLI (`agy`) signed in with the Google account that owns Google AI Pro

```bash
npm install
npm run build
npm start
```

Open <http://127.0.0.1:4174>.

No Gemini API key is used or needed. `agy` uses the existing local Google OAuth
session. The default models can be changed in `.env.local` using
`.env.example` as a guide.

## What “adaptive” means here

SATLAS deliberately separates measurement from interpretation.

The deterministic layer records facts and provides guardrails:

- correctness, selected answer, confidence, response time, hint use, difficulty
- difficulty-calibrated ability and mastery measurements
- recall dates and overdue review
- mock routing and transparent practice-score estimates

The Antigravity layer provides the analytical intelligence:

- analyses an individual answer only when the learner requests it after submission
- critiques the learner's written justification separately from answer correctness
- distinguishes concept, interpretation, elimination, execution, pacing, and confidence errors
- teaches the concept and recommends a concrete next move
- updates evidence-backed hypotheses, strengths, priorities, and per-skill difficulty directives
- analyses completed sets and mocks in context
- writes session reports and detailed weekly reports

AI directives influence question selection alongside the calibration guardrails.
The AI cannot rewrite raw evidence. Its claims are stored separately and cite
the attempt/session IDs that support them.

## Learning memory

[`data/README.md`](./data/README.md) documents the complete record:

```text
data/
  events/attempts.jsonl
  events/sessions.jsonl
  events/ai-observations.jsonl
  profile/skill-state.json
  profile/learner-model.json
  questions/generated.jsonl
  reports/session/*.md + *.json
  reports/weekly/*.md + *.json
  active/mock.json
```

Raw events use append-only JSONL. Derived learner state is readable JSON.
Reports are saved as both Markdown and JSON, so the whole folder can later be
given to ChatGPT, Claude, or another analysis workflow.

If Antigravity is offline or at quota, answers still save immediately. Missing
completed-session reports are recovered when the local server restarts. Full
mocks avoid per-question latency and are analysed as completed sessions.

## Included SAT content

- 31 revision lessons spanning all 8 published SAT domains
- 85 original Reading and Writing questions with balanced answer positions
- procedural Math generation across 20 skills and 5 structurally distinct difficulty levels
- original tables and plots for quantitative, statistical, and graph-based reasoning
- immediate authored explanations and distractor-specific feedback
- same-skill repair after a miss and spaced recall
- a 98-question, 134-minute two-stage mock with real module lengths, break,
  flags, review grid, calculator, and formula reference

## Verification

```bash
npm run check
npm audit --omit=dev
```

The automated suite checks the adaptive measurement model, routing, all Reading
and Writing items, 200 generated Math combinations, answer integrity, lesson
coverage, the full mock blueprint, and official-mock fidelity guardrails for
passage density, answer balance, representations, and structural difficulty.

## Official references

- [Google Antigravity plans and quota behavior](https://antigravity.google/docs/plans)
- [Antigravity CLI overview](https://antigravity.google/docs/cli-overview)
- [Antigravity CLI best practices](https://antigravity.google/docs/cli/best-practices)
- [College Board digital SAT test specifications](https://satsuite.collegeboard.org/media/pdf/digital-sat-test-overview.pdf)
- [College Board Assessment Framework](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf)
- [College Board official practice](https://satsuite.collegeboard.org/practice)
