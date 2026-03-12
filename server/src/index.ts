import { serve } from "@hono/node-server";
import { getPort } from "hono/node";
import app from "./router.js";

const port = parseInt(process.env.PORT || "3000");
const address = process.env.ADDRESS || "localhost";

console.log(`Memory server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
  address,
});

console.log(`Memory server running at http://${address}:${port}`);
