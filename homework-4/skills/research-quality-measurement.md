# Research Quality Measurement

This skill defines the labels and criteria the Research Verifier uses when
writing `verified-research.md`.

## Quality levels

Use **exactly one** of these labels, in descending order of confidence:

- **EXCELLENT** — every file:line reference in the research is correct;
  every code snippet matches source verbatim; the named root cause fully
  explains the observed symptom; nothing is speculative.
- **GOOD** — all file:line references correct; at most one minor snippet
  discrepancy (e.g. whitespace, comment drift) with no semantic impact; the
  named root cause explains the symptom.
- **ACCEPTABLE** — at most one wrong or missing file:line reference; root
  cause is plausible but missing one supporting detail; planning can still
  proceed.
- **WEAK** — multiple references are wrong, missing, or vague; or the named
  root cause does not fully account for the symptom. Planning should not
  proceed until research is redone.
- **INVALID** — research is empty, contradicts the source, or names files
  that do not exist. Reject and re-run the researcher.

## Verifier output format

`verified-research.md` must contain these sections in order:

1. **Verification Summary** — pass/fail and one of the labels above.
2. **Verified Claims** — bullet list of each researcher claim that was
   checked against source, with the verifier's confirmation.
3. **Discrepancies Found** — each mismatch between the research and source,
   with file:line and the diff.
4. **Research Quality Assessment** — restate the label, with the reasoning
   that places it at that level (which criteria were met, which were not).
5. **References** — every file:line consulted during verification.

The label drives Planner behaviour: EXCELLENT/GOOD/ACCEPTABLE → proceed;
WEAK/INVALID → orchestrator aborts the chain for this bug.
