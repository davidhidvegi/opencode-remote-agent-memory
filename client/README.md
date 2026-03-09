# OpenCode Memory Client

OpenCode plugin that fetches memory blocks from a remote server and injects them into the system prompt.

## Configuration

Create `.opencode/agent-memory.json`:

```json
{
  "remote": {
    "url": "https://your-memory-server.com/api",
    "apiKey": "your-api-key",
    "project": "your-project-name"
  },
  "journal": {
    "enabled": true,
    "tags": [
      { "name": "perf", "description": "Performance optimization work" },
      { "name": "debugging", "description": "Debugging sessions and findings" }
    ]
  }
}
```

**Configuration options:**

| Field | Required | Description |
|-------|----------|-------------|
| `remote.url` | Yes | Server URL (e.g., `http://localhost:3000/api`) |
| `remote.apiKey` | Yes | API key from server |
| `remote.project` | Yes | Project name for project-specific memories |
| `journal.enabled` | No | Enable journal (default: false) |
| `journal.tags` | No | Suggested tags for journal entries |

Then add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-remote-agent-memory"]
}
```

Restart OpenCode.

## Available Tools

### Memory Tools

| Tool | Description |
|------|-------------|
| `memory_get` | Get a specific memory block by label and scope |
| `memory_list` | List available memory blocks. Use `scope: "domain"` to retrieve domain knowledge on-demand |
| `memory_set` | Create or update a memory block (full overwrite) |
| `memory_replace` | Replace a substring within a memory block |

### Journal Tools (when enabled)

| Tool | Description |
|------|-------------|
| `journal_write` | Write a new journal entry with title, body, and optional tags |
| `journal_search` | Search entries semantically, filter by project or tags |
| `journal_read` | Read a specific journal entry by ID |

## Local Development

```bash
# Clone the repo
git clone https://github.com/davidhidvegi/opencode-remote-agent-memory.git

# Link the client to OpenCode
mkdir -p ~/.config/opencode/plugin
ln -sf "$(pwd)/client/src/plugin.ts" ~/.config/opencode/plugin/memory.ts
```
