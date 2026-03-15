# Memory Server

REST API for storing and sharing memory blocks and journal entries across OpenCode sessions.

## Quick Start

```bash
cd server
bun install
bun start
```

Server runs on `http://localhost:3000` by default. Use `ADDRESS` env var to bind to a different IP.

## Adding Users

```bash
# Interactive mode
bun run src/add-user.ts

# With arguments
bun run src/add-user.ts <id> <name> <apiKey>

# Example
bun run src/add-user.ts john "John Doe" "secret-api-key-123"
```

After creating a user, edit `data/users.json` to set permissions:

```json
{
  "id": "john",
  "name": "John Doe",
  "apiKey": "$2a$10$...",
  "permissions": {
    "global": "read",
    "users": [{ "SELF": "write" }],
    "projects": [{ "my-project": "write" }],
    "domain": "read"
  }
}
```

Permission levels: `none`, `read`, `write`. Special keys: `ALL`, `SELF`.

Restart the server after modifying permissions.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ADDRESS` | `localhost` | IP address to bind to (e.g., `0.0.0.0` for all interfaces) |

## Docker

```bash
docker-compose up -d
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/blocks/:scope` | List blocks (scope = global, user, domain, or project name) |
| GET | `/blocks/:scope/:label` | Get a specific block |
| POST | `/blocks/:scope/:label` | Create/update a block |
| PATCH | `/blocks/:scope/:label` | Replace text in a block |
| POST | `/journal` | Write a new journal entry |
| GET | `/journal` | List/search journal entries |
| GET | `/journal/:entryId` | Read a specific journal entry |

All requests require `Authorization: Bearer <apiKey>` header.

Journal is private to each user - users can only access their own entries.
