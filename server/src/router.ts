import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware, getCurrentUser } from "./auth.js";
import { hasPermission, getAccessibleUsers } from "./permissions.js";
import * as storage from "./storage/index.js";
import * as journalStorage from "./storage/journal.js";
import type { MemoryScope, CreateBlockRequest, ReplaceBlockRequest, CreateJournalRequest } from "./types.js";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

function getUserId(scope: string, userId: string): string | undefined {
  return scope === "user" ? userId : undefined;
}

app.get("/blocks/:scope/:label?", authMiddleware, async (c) => {
  const scope = c.req.param("scope");
  const label = c.req.param("label");
  const user = getCurrentUser(c);

  if (!label) {
    if (scope === "user") {
      const users = getAccessibleUsers(user);
      if (users.length === 0) return c.json({ error: "No read permission for scope: user" }, 403);
      const blocks = (await Promise.all(users.map((u) => storage.listBlocks("user", u)))).flat();
      return c.json(blocks);
    }

    const isSpecial = storage.isSpecialScope(scope);
    if (!isSpecial) {
      if (!hasPermission(user, "project", "read", scope)) {
        return c.json({ error: `No read permission for project: ${scope}` }, 403);
      }
      const blocks = await storage.listBlocks("project", scope);
      return c.json(blocks);
    }

    if (!hasPermission(user, scope as MemoryScope, "read")) return c.json({ error: `No read permission for scope: ${scope}` }, 403);
    const blocks = await storage.listBlocks(scope as MemoryScope);
    return c.json(blocks);
  }

  const isSpecial = storage.isSpecialScope(scope);
  const identifier = isSpecial ? getUserId(scope, user.id) : scope;

  if (!hasPermission(user, (isSpecial ? scope : "project") as MemoryScope, "read", identifier)) {
    return c.json({ error: `No read permission for ${isSpecial ? scope : "project"}: ${label}` }, 403);
  }

  const blockScope = isSpecial ? scope : "project";
  const block = await storage.getBlock(blockScope as MemoryScope, label, identifier);
  return c.json(block);
});

app.post("/blocks/:scope/:label", authMiddleware, async (c) => {
  const scope = c.req.param("scope");
  const label = c.req.param("label");
  const body = await c.req.json() as CreateBlockRequest;
  const user = getCurrentUser(c);

  const isSpecial = storage.isSpecialScope(scope);
  const identifier = isSpecial ? getUserId(scope, user.id) : scope;
  const blockScope = isSpecial ? scope : "project";

  if (!hasPermission(user, blockScope as MemoryScope, "write", identifier)) {
    return c.json({ error: `No write permission for ${blockScope}: ${label}` }, 403);
  }

  await storage.setBlock(blockScope as MemoryScope, label, body.value, { description: body.description, limit: body.limit }, identifier);
  return c.json({ success: true });
});

app.patch("/blocks/:scope/:label", authMiddleware, async (c) => {
  const scope = c.req.param("scope");
  const label = c.req.param("label");
  const body = await c.req.json() as ReplaceBlockRequest;
  const user = getCurrentUser(c);

  if (!body.old_text || body.new_text === undefined) return c.json({ error: "Missing old_text or new_text" }, 400);

  const isSpecial = storage.isSpecialScope(scope);
  const identifier = isSpecial ? getUserId(scope, user.id) : scope;
  const blockScope = isSpecial ? scope : "project";

  if (!hasPermission(user, blockScope as MemoryScope, "write", identifier)) {
    return c.json({ error: `No write permission for ${blockScope}: ${label}` }, 403);
  }

  await storage.replaceInBlock(blockScope as MemoryScope, label, body.old_text, body.new_text, identifier);
  return c.json({ success: true });
});

app.post("/journal", authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json() as CreateJournalRequest;
  const entry = await journalStorage.writeJournalEntry(user.id, body);
  return c.json(entry);
});

app.get("/journal", authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  const query = {
    text: c.req.query("text") || undefined,
    project: c.req.query("project") || undefined,
    tags: c.req.query("tags")?.split(",").map((t) => t.trim()).filter(Boolean),
    limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined,
    offset: c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined,
  };
  return c.json(await journalStorage.searchJournalEntries(user.id, query));
});

app.get("/journal/:entryId", authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  const entryId = c.req.param("entryId");
  return c.json(await journalStorage.getJournalEntry(user.id, entryId));
});

export default app;
