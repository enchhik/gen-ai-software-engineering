# 🤖 AI Usage Log — Homework 1

> Tool: **Claude Code (Opus 4.7)**, mostly in plan mode, then implementation mode.
> Style: incremental, with a written plan reviewed before any code was generated.

---

## Workflow phases

### Phase 1 — Project research

**Prompt:** *"вивчи проект"* (study the project)

**What Claude did:**
- Listed repo structure and read `README.md`, `homework-1/README.md`, `homework-1/TASKS.md`, `homework-1/HOWTORUN.md`
- Identified that `src/` was empty (only `.gitkeep`), `HOWTORUN.md` was a stub
- Saved structured project memory (course context, HW1 spec, my role)

**Why useful:** Prevented "AI assumes things" — every later answer was grounded in the actual repo.

📸 Screenshot: `docs/screenshots/project-research-1.png`

---

### Phase 2 — README pitfalls audit

**Prompt:** *"розкажи про @README.md, на що треба звернути увагу?"* + follow-up *"які pitfalls у цьому проекті?"*

**What Claude did:**
- Wrote a plan file `~/.claude/plans/graceful-mapping-mochi.md` with:
  - Red flags (PR direction must be **into the fork**, not upstream — easy to miss because GitHub defaults to upstream)
  - Grading weight breakdown (AI documentation = 25%, second-largest)
  - Required artifacts checklist (README, HOWTORUN, screenshots, demo files)
  - **20 specific pitfalls** grouped: process / technical / infrastructure
- Caught that the current branch was `homework-1` not the spec-required `homework-1-submission`

**What I verified myself:** Cross-checked the pitfalls against the actual `README.md` line numbers Claude cited.

📸 Screenshots: `readme-research-2.png`, `upd-plan-with-pitfalls-3.png`, `plan-approve-4.png`

---

### Phase 3 — Stack selection

**Prompt:** *"гілку я перейменував, давай почнемо з вибору стеку"*

**What Claude did:**
- Checked installed runtimes: Node 24.13, Python 3.14
- Recommended FastAPI (Pydantic gives the validation declaratively + free Swagger UI)
- Showed three options with side-by-side directory previews

**My choice:** Node.js + Express + zod + uuid (more familiar; IDE was already pre-set for Node).

📸 Screenshot: `stack-choose-5.png`

---

### Phase 4 — Implementation

**Prompt:** *"так"* (confirmation to start)

**What Claude did in one pass:**

1. `package.json` — express, zod, uuid + jest, supertest, nodemon, with scripts and a `jest` config
2. `src/storage.js` — array + add/list/findById/reset (reset for tests)
3. `src/validators/iso4217.js` — full ISO 4217 currency Set (~150 codes), not the 4-code shortcut
4. `src/validators/schema.js` — zod schemas for `ACC-XXXXX`, amount-with-2-decimals, currency, type-specific cross-field rules. `formatZodErrors()` to match the `{ field, message }` spec
5. `src/models/transaction.js` — factory that always controls `id`, `timestamp`, `status`
6. `src/routes/transactions.js` — POST, GET (filters), GET :id, GET /export?format=csv (Bonus C). Date filter inclusive-of-end-day. Manual CSV writer with proper escaping
7. `src/routes/accounts.js` — balance + summary (Bonus A); per-currency aggregation
8. `src/index.js` — `buildApp()` factory + listener split for testability; JSON parse-error middleware
9. `demo/run.sh` (chmod +x), `demo/sample-requests.http`, `demo/sample-data.json`
10. `tests/transactions.test.js` — 18 tests (happy paths, validation errors, filters, balance math, summary, CSV)

**Verification (Claude ran live):**
- `npm install` → 380 packages
- `npm test` → **18/18 passing**
- `npm start` on port 3001 + smoke test with `curl`:
  - Health, POST deposit/transfer/withdrawal, validation error (4 problems detected), list, filter, balance (`799.50` — verified by hand: 1000 − 150.50 − 50), summary, CSV

📸 Screenshot: `bonus+tests-6.png`

---

## Notable AI corrections / good calls

| Issue | What AI suggested | My check |
|---|---|---|
| Account regex | Used `[A-Za-z0-9]{5}` for `XXXXX` — *not* `\d+` | Matches the "alphanumeric" wording in `TASKS.md` |
| Amount validation | String regex `/^\d+(\.\d{1,2})?$/` instead of float comparison | Avoids the floating-point trap (`0.1 + 0.2`) |
| Balance per currency | Returned `{ USD: 799.5, EUR: 200 }` map, not a single number | One account can hold multi-currency txs in this in-memory model |
| Date filtering | Inclusive end-of-day for `?to=YYYY-MM-DD` | More user-friendly; matches typical banking UI behavior |
| Server-controlled fields | `id` / `timestamp` / `status` ignored from request body | Standard REST hygiene; prevents trivial spoofing |
| Pitfall: `homework-1` branch | Flagged that the spec wants `homework-1-submission` | Renamed before continuing |
| Pitfall: PR direction | Reminded that GitHub defaults to upstream as base | Avoided silent rejection |
