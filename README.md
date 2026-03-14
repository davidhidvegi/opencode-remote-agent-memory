# opencode-remote-agent-memory

Self-hosted remote [memory](https://github.com/joshuadavidthomas/opencode-agent-memory) for [OpenCode](https://opencode.ai) agents. Memory persists across sessions and machines.

## How It Works

The system has two parts:

1. **Server** - REST API that stores memory blocks and journal entries
2. **Client** - OpenCode plugin that fetches memory from the server and injects it into the system prompt

## Memory Scopes

| Scope | Description |
|-------|-------------|
| `global` | General facts that apply everywhere |
| `user` | User-specific info (bio, preferences, lessons learned) |
| `project` | Project-specific memories (architecture, conventions, commands) |
| `domain` | Domain knowledge retrieved on-demand (e.g., TypeScript, React patterns) |

## Journal

Append-only entries with semantic search. Tag entries for easy retrieval. Useful for capturing insights, decisions, and discoveries across sessions.

## Quick Start

```bash
# 1. Add a user
cd server && bunx tsx src/add-user.ts "myuser" "My User" "myapikey"

# 2. Start the server
cd server && bun install && bun start

# 3. Configure the client
echo '{
  "remote": {
    "url": "http://localhost:3000/",
    "apiKey": "myapikey",
    "project": "my-project"
  }
}' > .opencode/agent-memory.json
```

Then add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-remote-agent-memory"]
}
```

Restart OpenCode and ask the agent to manage your memory.

## Next Steps

- **[Server README](server/README.md)** - Docker deployment, environment variables, API reference
- **[Client README](client/README.md)** - Configuration options, available tools, local development

## Features

- Persistent memory across sessions and machines
- Self-editing memory blocks the agent can update
- Semantic search journal for capturing insights
- Permission system for multi-user support
- Docker support for easy deployment
