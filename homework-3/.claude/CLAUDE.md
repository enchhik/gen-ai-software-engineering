# homework-3 — Claude Code project rules

This file steers Claude Code (and any AI agent) working inside `homework-3/`. It is the project-local complement to the root `CLAUDE.md` of the course repo.

The product specified here is an **MFI Loan Decision & Disbursement Service** for the Ukrainian microfinance market. This homework is **specification-only** — no code is delivered. The agent's job in this directory is to produce, refine, and validate written artefacts: `specification.md`, `agents.md`, this file, and `README.md`.

---

## 1. Source-of-truth chain

When the agent has to resolve a question, the order of authority is:

1. NBU regulation (where cited in `specification.md` §5.1).
2. `specification.md`.
3. `agents.md`.
4. This file.
5. Root `CLAUDE.md` (course-wide conventions).

If the agent finds a conflict between any of these, it stops and surfaces the conflict to the human — it does not silently pick one.

---

## 2. What this homework produces

- `specification.md` — the layered spec.
- `agents.md` — behavioural rules for any AI that implements the spec.
- `.claude/CLAUDE.md` — this file.
- `README.md` — student info, rationale, AI tools log.

It does **not** produce:

- Source code under `src/`.
- Tests under `tests/`.
- A `HOWTORUN.md`.
- A `demo/` directory.
- Screenshots under `docs/screenshots/`.

If the agent feels the urge to scaffold any of the above, it stops and asks. Per `homework-3/TASKS.md`, this homework's deliverables are documents, not implementation.

---

## 3. Writing rules for documents in this directory

### 3.1 Language

- All documents in this directory are in **English**.
- Domain terms specific to Ukraine (NBU, RNOKPP, БКІ) are kept in their canonical form with a short translation on first use.
- The chat with the user is in **Ukrainian** (per root `CLAUDE.md`).

### 3.2 Tone

- Direct, dense, specific. Vague language ("should be fast", "appropriate latency") is rewritten with a concrete target.
- Tables and bullet lists are preferred over prose paragraphs when there is structure.
- One claim per bullet. If a bullet needs an "and", split it.

### 3.3 Numbers

- Every performance or policy target is a concrete number with a unit and a rationale, not a range without context.
- Numbers labelled "assumed" are clearly marked and explained.

### 3.4 Edge cases

- Edge cases live in their own section (`specification.md` §7).
- New edge cases discovered during work go into that section, not into the implementation prose.
- Each edge case has an ID (`F-1`, `T-2`, `S-3`, …) referenced from tests and tasks.

### 3.5 Cross-references

- The spec uses internal links and IDs. When the agent moves or renames a section, it updates all references in the same change.
- Tasks in §9 reference the Mid-Level Objectives they serve. Removing an MO requires removing the reference.

---

## 4. Domain rules for the specification author

These are constraints the agent must apply when editing `specification.md`:

- **PCI:** the spec never assumes PAN storage. It uses PSP card tokens only.
- **PII in logs:** the spec forbids logging of PAN, CVV, OTP, passport number, RNOKPP. Any new feature that needs one of these to be observed must add a redaction note.
- **NBU regulatory bounds:** any change to rates, retention period, or disclosure form must cite the regulation it derives from.
- **Idempotency:** every write operation in the spec is idempotent. The agent must not introduce a non-idempotent write.
- **State machine:** the `Loan` state diagram in §7.3 is canonical. Adding a state requires updating the diagram, the transitions list, the affected edge-cases, and the affected tasks.
- **Disclosure split:** `reason_category` (borrower) vs `reason_codes_detail` (internal) must remain two distinct fields throughout.

---

## 5. Style conventions

- Markdown headings use ATX style (`#`, `##`, …), one blank line above and below.
- Tables are GitHub-flavoured. Cell contents may wrap; long content goes in a list under the table.
- Code blocks for state diagrams and snippets are fenced; specify the language for syntax highlighting where applicable.
- File names are kebab-case where they appear in the spec (`loan-decision-api.yaml`).
- Identifiers in code-block examples use the conventions defined in `agents.md` §3.

---

## 6. When the agent should ask a question

The agent asks the human before making a change when:

- A change would affect the scope (move work in or out of the slice).
- A change would introduce or remove an external integration.
- A change would alter a regulatory assumption (rate cap, retention period, disclosure list).
- A change would relax an edge-case behaviour to make implementation simpler.
- A change would weaken the disclosure-split rule (5.).

The agent does **not** need to ask before:

- Fixing typos, formatting, broken links.
- Re-numbering edge cases after a renumber-causing change, as long as the change itself was approved.
- Adding a missing cross-reference between sections.

---

## 7. Commit conventions for this directory

Conventional Commits, scope `homework-3`:

```
feat(homework-3): add specification.md skeleton
fix(homework-3): correct NBU rate cap citation
docs(homework-3): expand stakeholders table with access logic
refactor(homework-3): renumber edge cases for consistency
```

Per root `CLAUDE.md`: commit messages and PR bodies are English; chat with the user is Ukrainian.

---

## 8. Verification of this homework's own deliverables

Before declaring this homework complete, the agent runs through this checklist:

- [ ] `specification.md` covers every section required by `homework-3/TASKS.md`.
- [ ] Cross-cutting requirements (edge cases, verification, performance) are first-class sections, not paragraphs inside other sections.
- [ ] Every Mid-Level Objective is observable.
- [ ] Every Low-Level Task references the MO it serves and has a Definition of Done.
- [ ] `agents.md` covers stack, domain rules, code style, verification, security defaults, edge-case handling.
- [ ] `README.md` covers student name, rationale, industry best practices with file/section references.
- [ ] No file under `src/`, `tests/`, `demo/`, `docs/screenshots/` has been created.
- [ ] All internal cross-references resolve.
- [ ] All NBU-derived numbers have a citation.
