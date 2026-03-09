import type { Context, Next } from "hono";
import bcrypt from "bcryptjs";
import type { User } from "./types.js";
import { UsersConfigSchema } from "./types.js";

const USERS_FILE = process.env.USERS_FILE || "./data/users.json";

let cachedUsers: User[] | null = null;

export async function loadUsers(): Promise<User[]> {
  if (cachedUsers) {
    return cachedUsers;
  }

  const { readFile } = await import("node:fs/promises");
  const content = await readFile(USERS_FILE, "utf-8");
  const parsed = JSON.parse(content);
  const config = UsersConfigSchema.parse(parsed);
  cachedUsers = config.users;
  return cachedUsers;
}

export function reloadUsers(): void {
  cachedUsers = null;
}

export async function authenticate(apiKey: string): Promise<User | null> {
  const users = await loadUsers();
  
  for (const user of users) {
    const isValid = await bcrypt.compare(apiKey, user.apiKey);
    if (isValid) {
      return user;
    }
  }
  
  return null;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const user = await authenticate(apiKey);
  
  if (!user) {
    return c.json({ error: "Invalid API key" }, 401);
  }
  
  c.set("user", user);
  await next();
}

export function getCurrentUser(c: Context): User {
  const user = c.get("user");
  if (!user) {
    throw new Error("User not found in context");
  }
  return user;
}
