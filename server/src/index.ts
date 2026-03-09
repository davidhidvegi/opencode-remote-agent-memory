import { serve } from "@hono/node-server";
import { getPort } from "hono/node";
import app from "./router.js";

const port = parseInt(process.env.PORT || "3000");

console.log(`Memory server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Memory server running at http://localhost:${port}`);
