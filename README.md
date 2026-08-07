# SATLAS

SATLAS is a private, local SAT learning hub with a continuously updated Gemini
learner model. The browser is only the interface. The canonical learning record
lives as readable files in [`data`](./data).

It is an independent study tool, not affiliated with or endorsed by College
Board. Every question in this repository is original. A local install can also
import questions from released practice forms the learner already owns; that
extract stays on the learner's machine and is never committed here.

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

- correctness, selected answer, optional five-point confidence, response time, hint use, difficulty
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
- writes a concise report after each completed set
- builds an everything-so-far report only when the learner requests one in Insights
- prepares original Reading and Writing questions at the start of a practice set

An adaptive mix reserves alternating Reading and Writing and Math slots, beginning
with the section that needs more evidence or repair. Section performance, per-skill
calibration, and analyst directives determine the target difficulty. A strong run
at Difficulty 2 therefore raises the next section target to Difficulty 3 instead
of leaving every skill pinned to its sparse default.

Fresh Reading and Writing questions use a validated blueprint derived from that
plan. Generated items must match the requested skill, domain, difficulty, passage
density, and visual requirements before they enter practice; invalid or unavailable
items fall back to the authored bank. Math remains deterministic, with distinct
structures at each difficulty so answers stay independently checkable.

Full mocks draw on the same generation. Before the first module, SATLAS writes a
batch of fresh Reading and Writing items and adds them to everything generated
for you previously, so repeat sittings are not the authored bank reshuffled. If
generation is slow, unavailable, or declined, the mock starts immediately from
the authored bank.

## Your own released forms

`scripts/import-official-questions.py` extracts real questions from the released
practice forms in `SAT Mocks` — passage, stem, choices, the official answer key,
and College Board's own explanation of why each wrong choice is wrong — and
writes them to `data/questions/official.jsonl`. Practice sets and mocks prefer
these over anything this app writes.

That file is gitignored and must stay that way. The questions are College
Board's copyright and this repository is public; the extract is for the owner's
local study only and is never committed. A clone without it simply has no
official material and falls back to the authored bank.

Extraction is conservative. An item is emitted only when it has four distinct
choices, a recognised official stem, a passage, and a key recovered from the
answer form, and only when it survives a sweep for two-column bleed and
mid-word truncation. Rejects and their reasons go to
`data/questions/official-rejects.jsonl` so the yield can be improved later.

## Passage length

Practice items give themselves away most often by being too short. The
guardrails here are therefore measured, not estimated:
`scripts/measure-official-density.py` extracts the seven official forms in
`SAT Mocks`, separates the printed columns, cuts the text into numbered
questions, and counts the words before each question stem. The resulting
per-skill percentiles live in `server/official-density.json` and are read by
both the authored-bank fidelity test and the Gemini generation bounds.

Against 208 measured official questions, the earlier bank ran 12 to 45 percent
short, worst on Command of Evidence and Inferences, where a real item is a full
research paragraph and the bank offered a single-sentence claim. Every skill now
meets or exceeds its official median, and the test fails if any item drops below
the official 25th percentile or past the official long tail.

AI directives influence selection alongside the calibration guardrails. The AI
cannot rewrite raw evidence. Its claims are stored separately and cite the answer
and session IDs that support them, while learner-facing report copy hides those
internal identifiers.

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
  reports/comprehensive/*.md + *.json
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
- 88 original Reading and Writing questions with balanced answer positions and
  passage lengths calibrated against a direct measurement of the supplied
  official forms rather than against an impression of them
- optional validated Gemini generation for fresh, history-aware Reading and
  Writing practice sets
- procedural Math generation across 20 skills and 5 structurally distinct difficulty levels
- original tables and plots for quantitative, statistical, and graph-based reasoning
- immediate authored explanations and distractor-specific feedback
- same-skill repair after a miss and spaced recall
- a 98-question, 134-minute two-stage mock with real module lengths, break,
  flags, review grid, the official College Board Desmos scientific and graphing
  configurations, and the complete SAT formula reference
- confidence begins unset and affects mastery or AI calibration only when the
  learner explicitly chooses one of five ratings

## Verification

```bash
npm run check
npm audit --omit=dev
```

The automated suite checks balanced adaptive planning, difficulty movement,
routing, all Reading and Writing items, generated Math combinations, answer
integrity, lesson coverage, the full mock blueprint, question order, paired-text
scarcity, passage density, answer balance, representations, and structural
difficulty.

## Honest limits

SATLAS is a high-fidelity practice and diagnosis tool, not an official score
predictor. Its mock score is a transparent practice estimate rather than College
Board equating, and no study tool can guarantee a 1600. Released forms still
remain the best final check for exact interface, diagram, wording, and scoring
behavior. SATLAS is designed to make the work between those checks more adaptive,
varied, and useful.

## Official references

- [Google Antigravity plans and quota behavior](https://antigravity.google/docs/plans)
- [Antigravity CLI overview](https://antigravity.google/docs/cli-overview)
- [Antigravity CLI best practices](https://antigravity.google/docs/cli/best-practices)
- [College Board digital SAT test specifications](https://satsuite.collegeboard.org/media/pdf/digital-sat-test-overview.pdf)
- [College Board Assessment Framework](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf)
- [College Board official practice](https://satsuite.collegeboard.org/practice)
- [College Board Bluebook testing tools](https://bluebook.collegeboard.org/students/tools)
- [Official Desmos College Board testing calculators](https://www.desmos.com/testing)
