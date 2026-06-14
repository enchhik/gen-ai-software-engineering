# How to Run

## GitHub MCP

This homework uses a project-scoped Codex MCP configuration in the repository root: `.codex/config.toml`.

Before opening Codex in this folder, export a GitHub personal access token:

```bash
export GITHUB_PAT="your-github-token"
```

For persistent Codex CLI sessions with `zsh`, add the export to your shell profile outside the repository:

```bash
echo 'export GITHUB_PAT="your-github-token"' >> ~/.zshrc
source ~/.zshrc
```

Then start Codex from the same terminal:

```bash
cd /Users/denis/Projects/gen-ai-software-engineering
codex
```

For the Codex desktop app on macOS, set the token for GUI-launched apps and restart Codex:

```bash
launchctl setenv GITHUB_PAT "your-github-token"
```

Check the value without printing the token:

```bash
launchctl getenv GITHUB_PAT
```

Do not commit the token to `.codex/config.toml` or any other repository file.

The GitHub MCP server is configured as:

```toml
[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_PAT"
```

Open Codex from the `homework-5` folder or start a new Codex thread with this folder as the workspace. Use `/mcp` to confirm the `github` server is connected.

Example verification prompt:

```text
Use GitHub MCP to list recent pull requests in enchhik/gen-ai-software-engineering.
```

Save the successful request and response screenshot as:

```text
docs/screenshots/github-mcp-result.png
```

## Filesystem MCP

The Filesystem MCP server is configured in the repository root `.codex/config.toml` and is limited to this homework repository:

```toml
[mcp_servers.filesystem]
command = "npx"
args = [
  "-y",
  "@modelcontextprotocol/server-filesystem",
  "/Users/denis/Projects/gen-ai-software-engineering"
]
```

Open a new Codex thread from the repository root after updating the MCP configuration. Use `/mcp` to confirm the `filesystem` server is connected.

Example verification prompt:

```text
Use Filesystem MCP to list files in /Users/denis/Projects/gen-ai-software-engineering/homework-5.
```

Save the successful request and response screenshot as:

```text
docs/screenshots/filesystem-mcp-result.png
```

## Notion MCP

The Notion MCP server is configured in the repository root `.codex/config.toml`:

```toml
[mcp_servers.notion]
url = "https://mcp.notion.com/mcp"
```

Authenticate with Notion OAuth:

```bash
codex mcp login notion
```

Complete the browser authorization flow and connect the relevant Notion workspace.

Start Codex from the repository root:

```bash
cd /Users/denis/Projects/gen-ai-software-engineering
codex
```

Use `/mcp` to confirm the `notion` server is connected.

If the Notion workspace is empty, create a small demo project with bug pages through Notion MCP:

```text
Use Notion MCP to create a page named "Homework 5 MCP Demo Project". Under it, create five child pages representing bugs:
1. BUG-001 - Login form validation fails
2. BUG-002 - Export button stays disabled
3. BUG-003 - Dashboard cards overlap on mobile
4. BUG-004 - Search results ignore status filter
5. BUG-005 - Settings page shows stale profile data

Add a short status and priority note to each page. Return only the created page titles or IDs.
```

Example verification prompt:

```text
Use Notion MCP to give me the pages of the last 5 bugs on the "Homework 5 MCP Demo Project" project. Return only page titles or page IDs.
```

Save the successful request and response screenshot as:

```text
docs/screenshots/notion-mcp-result.png
```

## Custom FastMCP Server

The custom FastMCP server lives in `custom-mcp-server/`.

Install dependencies:

```bash
cd /Users/denis/Projects/gen-ai-software-engineering/homework-5/custom-mcp-server
python3 --version  # use Python 3.10 or newer
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Run the unit tests:

```bash
.venv/bin/python -m unittest test_server.py
```

Start the server directly:

```bash
.venv/bin/python server.py
```

The Codex MCP configuration is in the repository root `.codex/config.toml`:

```toml
[mcp_servers.custom_lorem]
command = "/Users/denis/Projects/gen-ai-software-engineering/homework-5/custom-mcp-server/.venv/bin/python"
args = ["server.py"]
cwd = "/Users/denis/Projects/gen-ai-software-engineering/homework-5/custom-mcp-server"
startup_timeout_sec = 60
```

The server exposes:

- Resource `lorem://content` for the default 30-word output.
- Resource `lorem://content/{word_count}` for word-limited output.
- Tool `read` with optional `word_count`, defaulting to 30.

Resources are URIs that Claude or Codex can read from, such as files, APIs, or generated content. Tools are actions the AI can call to perform operations, such as reading a file or running a command.

Example verification prompt:

```text
Use the custom_lorem MCP read tool with word_count 12 and show the returned content.
```

Save the successful request and response screenshot as:

```text
docs/screenshots/custom-mcp-read-tool-result.png
```
