# Homework 5: MCP Server Configuration

Author: Denys Ostrometskyi

## GitHub MCP

The GitHub MCP server is configured for Codex in the repository root `.codex/config.toml`.

The configuration uses the remote GitHub MCP endpoint and reads the access token from the `GITHUB_PAT` environment variable. The token is intentionally not committed to the repository.

Verification request:

```text
Use GitHub MCP to list recent pull requests in enchhik/gen-ai-software-engineering.
```

Expected evidence:

- Screenshot of the successful GitHub MCP request and response at `docs/screenshots/github-mcp-result.png`.

## Filesystem MCP

The Filesystem MCP server is configured for Codex in the repository root `.codex/config.toml`.

The server is limited to `/Users/denis/Projects/gen-ai-software-engineering`, so Codex can inspect this homework repository without granting broader filesystem access.

Verification request:

```text
Use Filesystem MCP to list files in /Users/denis/Projects/gen-ai-software-engineering/homework-5.
```

Expected evidence:

- Screenshot of the successful Filesystem MCP request and response at `docs/screenshots/filesystem-mcp-result.png`.

## Notion MCP

The Notion MCP server is configured for Codex in the repository root `.codex/config.toml`.

The configuration uses Notion's hosted MCP endpoint and OAuth authentication. No Notion token is committed to the repository.

Verification request:

```text
Use Notion MCP to give me the pages of the last 5 bugs on the "Homework 5 MCP Demo Project" project. Return only page titles or page IDs.
```

Expected evidence:

- Screenshot of the successful Notion MCP request and response at `docs/screenshots/notion-mcp-result.png`.

## Custom FastMCP Server

The custom MCP server is implemented in `custom-mcp-server/server.py` using FastMCP.

It exposes:

- Resource `lorem://content` for default 30-word content from `custom-mcp-server/lorem-ipsum.md`.
- Resource `lorem://content/{word_count}` for word-limited resource reads.
- Tool `read` with optional `word_count`, defaulting to 30.

Resources are URIs that Claude or Codex can read from, such as files, APIs, or generated content. Tools are actions the AI can call to perform operations, such as reading a file or running a command.

Verification request:

```text
Use the custom_lorem MCP read tool with word_count 12 and show the returned content.
```

Expected evidence:

- Screenshot of the successful custom MCP `read` tool response at `docs/screenshots/custom-mcp-read-tool-result.png`.
