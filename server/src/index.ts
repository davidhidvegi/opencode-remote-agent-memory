import { serve } from "@hono/node-server";
import { getPort } from "hono/node";
import app from "./router.js";
import { initializeModels } from "./storage/journal.ts";
import { initializeMemory, initializeDefaultUser } from "./storage/init.ts";

const port = parseInt(process.env.PORT || "3000");
const address = process.env.ADDRESS || "localhost";
const defaultUser = process.env.DEFAULT_USER || "guest";
const defaultProject = process.env.DEFAULT_PROJECT || "default";
const defaultPassword = process.env.DEFAULT_PASSWORD || "guest123";

await initializeModels();
await initializeDefaultUser(defaultUser, defaultPassword);
await initializeMemory(defaultUser, defaultProject);

console.log(`Memory server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
  address,
});

console.log(`Memory server running at http://${address}:${port}`);
