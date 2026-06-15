/cc @Alexey-Popov — homework-4 ready for review.

## Що зроблено

Реалізовано 6-агентний pipeline, який однією командою (`npm run pipeline`) виправляє чотири навмисні дефекти в маленькому Express-застосунку. Стек — **Node ≥ 20 (ESM) + Express + better-sqlite3 + `node:test` + supertest**.

- **Sample app** ([`homework-4/src/`](./homework-4/src)) — REST API «Users & Auth» (register / login / profile / search / paginated list), реальна SQLite БД.
- **Seeded defects** ([`homework-4/context/bugs/*`](./homework-4/context/bugs)):
  - `BUG-1` — пагінація `GET /users` (немає дефолту `limit=10`, off-by-one на `offset`).
  - `BUG-2` — case-sensitive email lookup у `POST /auth/login`.
  - `SEC-1` — SQL injection у `GET /users/search`.
  - `SEC-2` — hardcoded HMAC secret + plaintext password storage в `src/auth.js`.
- **6 агентів** ([`homework-4/agents/`](./homework-4/agents)) — Bug Researcher → Research Verifier → Bug Planner → Bug Fixer → Security Verifier → Unit Test Generator. Кожен `*.agent.md` має YAML frontmatter з моделлю та path-restriction секцію.
- **2 skills** ([`homework-4/skills/`](./homework-4/skills)) — `research-quality-measurement.md` (рівні якості дослідження) і `unit-tests-FIRST.md` (FIRST з прикладом для `node:test` + supertest).
- **Orchestrator** ([`homework-4/scripts/run-pipeline.js`](./homework-4/scripts/run-pipeline.js)) — Node-скрипт, що викликає `claude -p` headless 6 разів на баг, інлайнить skill у system prompt, гейтить `--allowedTools`, перевіряє boundary через `git status` diff проти baseline, робить вузький auto-commit після кожного успішного багу. Фінальна верифікація `npm test` лише для full-run.
- **Документація** — [`homework-4/README.md`](./homework-4/README.md) (overview, моделі, known limitations), [`homework-4/HOWTORUN.md`](./homework-4/HOWTORUN.md) (точні команди).

Внутрішні спеки й плани, з яких я працював, теж у репо: [`docs/superpowers/specs/`](./homework-4/docs/superpowers/specs), [`docs/superpowers/plans/`](./homework-4/docs/superpowers/plans).

## Відповідність TASKS.md

- **Task 1 — Bug Research Verifier:** [`agents/research-verifier.agent.md`](./homework-4/agents/research-verifier.agent.md), використовує skill [`skills/research-quality-measurement.md`](./homework-4/skills/research-quality-measurement.md). Виходи — `context/bugs/<ID>/research/verified-research.md` для всіх 4 багів.
- **Task 2 — Bug Fixer:** [`agents/bug-fixer.agent.md`](./homework-4/agents/bug-fixer.agent.md). Виходи — `fix-summary.md` для всіх 4 багів; всі 4 фікси застосовані у [`src/`](./homework-4/src).
- **Task 3 — Security Vulnerabilities Verifier:** [`agents/security-verifier.agent.md`](./homework-4/agents/security-verifier.agent.md). Виходи — `security-report.md` для всіх 4 багів. Severity-ladder CRITICAL/HIGH/MEDIUM/LOW/INFO; no code edits.
- **Task 4 — Unit Test Generator:** [`agents/unit-test-generator.agent.md`](./homework-4/agents/unit-test-generator.agent.md), використовує skill [`skills/unit-tests-FIRST.md`](./homework-4/skills/unit-tests-FIRST.md). Виходи — `test-report.md` для всіх 4 багів + ~35 нових тестів у [`tests/`](./homework-4/tests).
- **Task 5 — Sample Mini Application:** [`src/`](./homework-4/src) + [`tests/`](./homework-4/tests), 4 seeded дефекти описані в [`context/bugs/*/bug-context.md`](./homework-4/context/bugs).
- **Single-command execution:** `npm run pipeline` (full sweep) або `npm run pipeline -- BUG-2` (single bug).
- **Agent models у frontmatter + обґрунтування в README:** так, кожен `.agent.md` має `model:` у frontmatter; таблиця з обґрунтуванням — у [`homework-4/README.md`](./homework-4/README.md).

## Як перевірити

```bash
cd homework-4
npm install
npm test
```

Очікувано post-pipeline: `tests 54, pass 54, fail 0`.

Запустити сам app:

```bash
npm start
# в іншому терміналі
curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"alice-pass"}'
```

Запустити pipeline (потрібен `claude` CLI + auth):

```bash
npm run pipeline -- BUG-2     # smoke на один баг (дешево)
npm run pipeline              # повний sweep по 4 багах
```

Артефакти pipeline:

```bash
ls homework-4/context/bugs/BUG-1/    # research/, implementation-plan.md, fix-summary.md, security-report.md, test-report.md
```

Остання локальна перевірка:

- `npm test`: 54 / 54 pass.
- `git log --oneline | grep "apply pipeline-generated fix"`: 4 commit (BUG-1, BUG-2, SEC-1, SEC-2).
- Pipeline orchestrator самостійно ловить, коли агент пише поза дозволеним scope (snapshot-based boundary check), і завершує chain без destructive cleanup.

## Context-Model-Prompt / AI-інструменти

**Context:**

- [`homework-4/TASKS.md`](./homework-4/TASKS.md) — оригінальне завдання.
- [`homework-4/docs/superpowers/specs/`](./homework-4/docs/superpowers/specs) — design specs (sample app + pipeline architecture).
- [`homework-4/docs/superpowers/plans/`](./homework-4/docs/superpowers/plans) — implementation plans (sample app + pipeline).
- Попередні approved PR у цьому fork (`homework-1`, `homework-2`, `homework-3`, `homework-5`) як формат submission body.
- Claude Code документація (`claude -p`, `--append-system-prompt`, `--allowedTools`, `--setting-sources`) для оркестрації.

**Model:**

- **Claude Code Opus 4.7 / medium effort** — основна сесія розробки в Claude Code TUI: brainstorming, написання specs і plans, дизайн orchestrator'а, ручні правки, perевірки, координація subagent-driven-execution.
- **Subagents через Task tool** — `general-purpose` для implementer-кроків плану і `superpowers:code-reviewer` для spec/code-quality review після кожної задачі. Моделі цих subagents визначає Claude Code-харнес.
- **Pipeline-агенти**, оркестровані через `claude -p` headless з [`scripts/run-pipeline.js`](./homework-4/scripts/run-pipeline.js):
  - Bug Researcher / Bug Planner — Sonnet 4.6.
  - Research Verifier / Security Verifier — Opus 4.7 (TASKS.md: «stronger reasoning»).
  - Bug Fixer / Unit Test Generator — Haiku 4.5 (TASKS.md: «faster/cheaper»).

**Prompt:**

- TDD-flow для коду застосунку: для кожної задачі — спочатку failing test, потім реалізація, тести позеленіли, коміт.
- Subagent-driven execution планів: один свіжий subagent на задачу + spec compliance review + code quality review після кожної.
- Для самого pipeline-прогону — system prompt кожного агента інлайниться з [`agents/*.agent.md`](./homework-4/agents) + опційно skill з [`skills/`](./homework-4/skills), user prompt лише вказує bug id і робочу директорію.

Детальний хід роботи (brainstorming → spec → plan → execution → debugging boundary-guard'а → smoke-run → full pipeline) задокументований у комітах і скриншотах діалогу ([`docs/screenshots/01-05`](./homework-4/docs/screenshots)).

## Known limitations

Свідомо лишив у репо як демонстрацію того, що Bug Fixer (Haiku) робить не все ідеально, а Security Verifier (Opus) це підхоплює:

- `SEC-2` зафіксовано з fallback на hardcoded secret — Security Verifier сам флагнув це як **HIGH** у [`context/bugs/SEC-2/security-report.md`](./homework-4/context/bugs/SEC-2/security-report.md) (F-1). Fail-fast версія була б кращою; Bug Fixer обрав менш сувору опцію.
- `verifyPassword` падає на malformed `salt:hash` (Security Verifier — **MEDIUM**, F-2 у тому ж репорті).
- `verifyToken` HMAC порівняння не constant-time (pre-existing, не в scope жодного seeded bug'а).
- Застарілі коментарі `// BUG-1(a) / (b):` у `src/routes/users.js` Bug Fixer не прибрав (cosmetic).

Більше — у секції «Known limitations from the pipeline run» в [`homework-4/README.md`](./homework-4/README.md).

## Скріншоти

Повний індекс — у [`homework-4/docs/screenshots/README.md`](./homework-4/docs/screenshots/README.md).

Full pipeline run (всі 4 баги, exit code 0):

![Full pipeline run](https://raw.githubusercontent.com/enchhik/gen-ai-software-engineering/homework-4-submission/homework-4/docs/screenshots/10-work-agents-pipeline.png)

Smoke run на BUG-2:

![BUG-2 smoke](https://raw.githubusercontent.com/enchhik/gen-ai-software-engineering/homework-4-submission/homework-4/docs/screenshots/09-pipeline-bug2-success.png)

Post-run quality review:

![Post-run analysis](https://raw.githubusercontent.com/enchhik/gen-ai-software-engineering/homework-4-submission/homework-4/docs/screenshots/11-success-pipeline.png)
