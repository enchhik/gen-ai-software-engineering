# Homework 5 — MCP Server Configuration

> **Student:** Denys Ostrometskyi
> **Date submitted:** 2026-06-14
> **AI tools used:** OpenAI Codex (`gpt-5.5`) for MCP configuration, custom FastMCP implementation, documentation, and verification. Workflow described below.

---

## Task summary

This homework asks to configure **three external MCP servers** and build **one custom MCP server** with FastMCP. The client used for this submission is **Codex CLI**, so the MCP configuration is stored in the Codex-native project config file:

- [`.codex/config.toml`](../.codex/config.toml)

Configured servers:

| Server | Purpose | Verification evidence |
|---|---|---|
| **GitHub MCP** | Query GitHub repository data through the hosted GitHub MCP endpoint | [`docs/screenshots/github-mcp-result.png`](./docs/screenshots/github-mcp-result.png) |
| **Filesystem MCP** | List and inspect files inside this homework repository | [`docs/screenshots/filesystem-mcp-result.png`](./docs/screenshots/filesystem-mcp-result.png) |
| **Notion MCP** | Query Notion pages from a real workspace through OAuth | [`docs/screenshots/notion-mcp-result.png`](./docs/screenshots/notion-mcp-result.png) |
| **Custom FastMCP server** | Read word-limited content from `lorem-ipsum.md` via resource/tool | [`docs/screenshots/custom-mcp-read-tool-result.png`](./docs/screenshots/custom-mcp-read-tool-result.png) |

Files delivered in this directory:

| File / Folder | Purpose |
|---|---|
| [`README.md`](./README.md) | This file — student info, task summary, rationale, AI workflow, and evidence |
| [`HOWTORUN.md`](./HOWTORUN.md) | Reproducible setup, auth, run, and verification instructions |
| [`custom-mcp-server/server.py`](./custom-mcp-server/server.py) | Custom FastMCP server implementation |
| [`custom-mcp-server/lorem-ipsum.md`](./custom-mcp-server/lorem-ipsum.md) | Source text used by the custom MCP resource and tool |
| [`custom-mcp-server/requirements.txt`](./custom-mcp-server/requirements.txt) | Python dependencies; explicitly includes `fastmcp` |
| [`custom-mcp-server/test_server.py`](./custom-mcp-server/test_server.py) | Unit tests for `word_count` behaviour |
| [`docs/screenshots/`](./docs/screenshots) | MCP call screenshots and dialog evidence |

---

## Configuration choices

### Codex-native MCP config

The homework text allows `mcp.json` / `.mcp.json`, but Codex CLI reads project MCP configuration from `.codex/config.toml`. To keep the submission runnable in the actual client used for the homework, the repository contains a root-level Codex config:

```toml
[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_PAT"

[mcp_servers.filesystem]
command = "npx"
args = [
  "-y",
  "@modelcontextprotocol/server-filesystem",
  "/Users/denis/Projects/gen-ai-software-engineering"
]

[mcp_servers.notion]
url = "https://mcp.notion.com/mcp"

[mcp_servers.custom_lorem]
command = "/Users/denis/Projects/gen-ai-software-engineering/homework-5/custom-mcp-server/.venv/bin/python"
args = ["server.py"]
cwd = "/Users/denis/Projects/gen-ai-software-engineering/homework-5/custom-mcp-server"
startup_timeout_sec = 60
```

Secrets are not committed. GitHub uses the `GITHUB_PAT` environment variable. Notion uses OAuth via:

```bash
codex mcp login notion
```

### Notion demo project

The Notion workspace was newly created and did not contain an existing bug project. To satisfy the requirement using a real workspace, Notion MCP was used to create a small project named **Homework 5 MCP Demo Project** with five child bug pages:

- `BUG-001 - Login form validation fails`
- `BUG-002 - Export button stays disabled`
- `BUG-003 - Dashboard cards overlap on mobile`
- `BUG-004 - Search results ignore status filter`
- `BUG-005 - Settings page shows stale profile data`

The verification prompt then queried the last five bug pages from that project and returned only page titles/IDs.

### Custom FastMCP server design

The custom server keeps the MCP layer thin and testable:

- `read_lorem_words()` contains the word-count logic.
- `lorem://content` returns the default 30-word content.
- `lorem://content/{word_count}` returns word-limited resource content.
- Tool `read` accepts optional `word_count` and delegates to the same function.

This avoids duplicating word-limit logic between resource and tool handlers.

---

## Verification performed

### Automated checks

Custom server unit tests:

```bash
cd homework-5/custom-mcp-server
.venv/bin/python -m unittest test_server.py
```

Last local result:

```text
Ran 2 tests in 0.001s
OK
```

Direct word-count check:

```bash
.venv/bin/python -c "from server import read_lorem_words; value = read_lorem_words(12); print(value); print(len(value.split()))"
```

Last local result:

```text
Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor
12
```

Codex MCP configuration check:

```bash
codex mcp list
```

Last local result showed the expected servers enabled:

- `github`
- `filesystem`
- `notion`
- `custom_lorem`

### Manual MCP call evidence

The following screenshots show real MCP calls in Codex CLI:

| Screenshot | What it proves |
|---|---|
| [`github-mcp-result.png`](./docs/screenshots/github-mcp-result.png) | GitHub MCP was connected and used to list repository pull requests |
| [`filesystem-mcp-result.png`](./docs/screenshots/filesystem-mcp-result.png) | Filesystem MCP was connected and used to list files in `homework-5` |
| [`notion-mcp-result.png`](./docs/screenshots/notion-mcp-result.png) | Notion MCP was connected through OAuth and returned five bug pages |
| [`custom-mcp-read-tool-result.png`](./docs/screenshots/custom-mcp-read-tool-result.png) | Custom FastMCP `read` tool returned 12 words |

Additional traceability screenshots:

| Screenshot | Purpose |
|---|---|
| [`github-mcp-setup-dialog.png`](./docs/screenshots/github-mcp-setup-dialog.png) | GitHub MCP setup/debug dialog |
| [`custom-mcp-implementation-dialog.png`](./docs/screenshots/custom-mcp-implementation-dialog.png) | Custom FastMCP implementation dialog |
| [`custom-mcp-verification-dialog.png`](./docs/screenshots/custom-mcp-verification-dialog.png) | Custom FastMCP verification dialog |

---

## AI tools used — process notes

The submission was completed with OpenAI Codex in an iterative workflow:

1. Read [`TASKS.md`](./TASKS.md) and repository rules.
2. Configured GitHub MCP in `.codex/config.toml`, corrected the env var name to `GITHUB_PAT`, and verified it through Codex CLI.
3. Added Filesystem MCP scoped to the repository root and verified directory listing via MCP.
4. Added Notion MCP using the official hosted endpoint and OAuth flow, then created/query-tested the demo bug project.
5. Implemented the custom FastMCP server using a small TDD loop:
   - wrote tests for requested word count and default 30-word behaviour;
   - implemented `read_lorem_words`;
   - wrapped it with FastMCP resource/tool handlers;
   - verified with unit tests and a FastMCP client call.
6. Added documentation and screenshots matching the homework deliverables.

What was verified manually:

- No real GitHub or Notion tokens are committed.
- `.venv` and `__pycache__` are not committed.
- Screenshots show actual MCP call results, not only configuration text.
- `requirements.txt` explicitly includes `fastmcp`.

---

## Challenges

- **Codex config format vs. homework wording.** The task mentions `mcp.json`, but Codex CLI uses `.codex/config.toml`. I used the Codex-native format so the submitted config is actually runnable.
- **Environment variables in CLI sessions.** GitHub MCP initially failed because the token was exported in another shell. The final setup documents `GITHUB_PAT` clearly and keeps secrets outside the repo.
- **Empty Notion workspace.** A demo project had to be created first, then queried as the real Notion evidence source.
- **Python version for FastMCP.** System Python was too old for current `fastmcp`; the final setup uses a local virtual environment with Python 3.10+ and documents that requirement.

---

## How to verify this submission

1. Read [`.codex/config.toml`](../.codex/config.toml) and confirm all four MCP servers are configured.
2. Follow [`HOWTORUN.md`](./HOWTORUN.md) for auth and setup.
3. Run the custom server tests:

```bash
cd homework-5/custom-mcp-server
python3 --version  # Python 3.10+
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m unittest test_server.py
```

4. Start Codex from the repository root:

```bash
codex
```

5. Run `/mcp` and confirm `github`, `filesystem`, `notion`, and `custom_lorem` are listed.
6. Re-run the verification prompts from [`HOWTORUN.md`](./HOWTORUN.md).
7. Review screenshots in [`docs/screenshots/`](./docs/screenshots).

---

<div align="center">

*This homework was completed as part of the GenAI and Agentic AI for Software Engineering course.*

</div>
