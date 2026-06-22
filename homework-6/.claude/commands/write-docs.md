---
description: Agent 4 — generate README and project documentation
---

Documentation meta-agent (Agent 4). Generate and keep the project docs current.

Steps:
1. Update `README.md`:
   - Include the student name (`Created by Denys Ostrometskyi`).
   - 1–2 paragraphs on what the system does.
   - One bullet per runtime agent (Validator, Fraud Detector, Settlement Processor).
   - ASCII architecture diagram of the pipeline flow.
   - Tech-stack table.
2. Update `HOWTORUN.md` with numbered steps from setup to demo, including the slash commands
   and the note to launch Claude Code from `homework-6/`.
3. Keep docs consistent with the actual business rules (decimal.js, ISO 4217, score ≥ 50,
   0.5% fee, short-circuit to `shared/results/`).
4. Do not invent behavior that the runtime does not implement.
