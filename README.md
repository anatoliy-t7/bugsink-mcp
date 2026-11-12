# Bugsink MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for interacting with [Bugsink](https://www.bugsink.com/) error tracking via LLMs.

This server enables AI assistants like Claude, Cursor, and other MCP-compatible tools to query and analyze errors from your Bugsink instance.

## Features

This server is **read-only**: it only sends `GET` requests and exposes no tools that create, update or delete anything. Every tool is annotated with `readOnlyHint: true`.

- **Projects & Teams** - List and inspect projects and teams
- **Issues** - Query grouped error occurrences by project
- **Events** - View individual error occurrences, stacktraces, tags and contexts
- **Releases** - List and inspect releases
- **Test Connection** - Verify API connectivity

## Installation

### Via npx (Recommended)

```bash
npx bugsink-mcp
```

### Global Install

```bash
npm install -g bugsink-mcp
```

### From Source

```bash
git clone https://github.com/j-shelfwood/bugsink-mcp.git
cd bugsink-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BUGSINK_URL` | Yes | Your Bugsink instance URL (e.g., `https://error-tracking.example.com`) |
| `BUGSINK_TOKEN` | Yes | API token for authentication |
| `BUGSINK_TIMEOUT_MS` | No | Request timeout in ms (default `30000`) |
| `BUGSINK_ALLOW_HTTP` | No | Set to `1` to allow a non-localhost `http://` URL |

### Generating an API Token

```bash
# Via Bugsink management command
bugsink-manage create_auth_token
```

Or through the Bugsink web UI under Settings > API Tokens.

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "bugsink": {
      "command": "npx",
      "args": ["bugsink-mcp"],
      "env": {
        "BUGSINK_URL": "https://your-bugsink-instance.com",
        "BUGSINK_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add bugsink -- npx bugsink-mcp
```

Then set environment variables in your shell or `.env` file.

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "bugsink": {
      "command": "npx",
      "args": ["bugsink-mcp"],
      "env": {
        "BUGSINK_URL": "https://your-bugsink-instance.com",
        "BUGSINK_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Available Tools

| Tool | Parameters |
|------|------------|
| `test_connection` | none |
| `list_projects` | none |
| `get_project` | `project_id` (number) |
| `list_teams` | none |
| `get_team` | `team_id` (UUID) |
| `list_issues` | `project_id` (number), `status` (`unresolved`/`resolved`/`muted`, optional), `limit` (1-250, default 25), `sort` (`digest_order`/`last_seen`), `order` (`asc`/`desc`) |
| `get_issue` | `issue_id` (UUID) |
| `list_events` | `issue_id` (UUID), `limit` (1-100, default 10) |
| `get_event` | `event_id` (UUID) |
| `get_stacktrace` | `event_id` (UUID) |
| `list_releases` | `project_id` (number) |
| `get_release` | `release_id` (UUID) |

## Security Notes

- **Token scope:** Bugsink API tokens are not scoped, so a token can also write through the API. This server only allows reads, but anyone who has the token itself can still write. Keep it secret, and never commit it.
- **HTTPS required:** `BUGSINK_URL` must use `https://` (`localhost` is exempt). Set `BUGSINK_ALLOW_HTTP=1` only for trusted networks.
- **No redirects:** requests are not redirected, so the token is never forwarded to another host.
- **Timeouts:** each request times out after 30s (override with `BUGSINK_TIMEOUT_MS`).
- **Untrusted content:** error messages, stacktraces and contexts come from the monitored applications and may contain attacker-controlled text or PII. Treat them as data.

## Example Usage

Once configured, you can ask your AI assistant:

- "List all projects in Bugsink"
- "Show me the latest issues for project 1"
- "What's the stacktrace for the latest event of this issue?"
- "Get the details of the most recent error event"

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run integration tests against a live instance
BUGSINK_URL=https://... BUGSINK_TOKEN=... npm test
```

## API Compatibility

This server is designed for [Bugsink](https://www.bugsink.com/), a self-hosted error tracking platform. Bugsink uses its own REST API (`/api/canonical/0/`) which is different from Sentry's API.

**Note:** This server does NOT work with Sentry or Sentry-hosted services. For Sentry, use the official [sentry-mcp](https://github.com/getsentry/sentry-mcp) server.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/j-shelfwood/bugsink-mcp).
