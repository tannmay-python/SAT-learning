# SATLAS learning memory

This folder is the canonical record of your SAT work. The browser does not own
or persist learning history.

- `events/attempts.jsonl` — one immutable raw answer event per line, including
  the complete question snapshot.
- `events/sessions.jsonl` — completed practice sets and mocks.
- `events/ai-observations.jsonl` — only the Gemini reviews you explicitly
  request, including your written justification; kept separate from raw facts.
- `profile/skill-state.json` — deterministic calibration and recall state.
- `profile/learner-model.json` — the analyst's current evidence-backed model.
- `questions/generated.jsonl` — accepted original AI-generated items.
- `reports/session/` and `reports/weekly/` — readable Markdown plus machine-readable JSON.
- `active/mock.json` — an in-progress full mock, so it can resume after a restart.

JSONL files are append-only evidence. Derived snapshots can be rebuilt from
them. AI claims cite evidence IDs and should say when evidence is insufficient.
