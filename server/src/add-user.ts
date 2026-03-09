import bcrypt from "bcryptjs";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import * as path from "node:path";

const USERS_FILE = process.env.USERS_FILE || "./data/users.json";

interface User {
  id: string;
  name: string;
  apiKey: string;
  permissions: {
    global: "none" | "read" | "write";
    users: Array<{ [key: string]: "none" | "read" | "write" }>;
    projects: Array<{ [key: string]: "none" | "read" | "write" }>;
    domain: "none" | "read" | "write";
  };
}

interface UsersConfig {
  users: User[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function prompt(question: string): Promise<string> {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  let id: string, name: string, apiKey: string;

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: bun run src/add-user.ts <id> <name> <apiKey>");
    console.log("Or run without arguments for interactive mode:");
    console.log("Usage: bun run src/add-user.ts");
    process.exit(0);
  } else if (process.argv.length >= 5) {
    id = process.argv[2];
    name = process.argv[3];
    apiKey = process.argv[4];
  } else {
    console.log("Interactive mode - press Ctrl+C to cancel\n");
    id = await prompt("User ID: ");
    name = await prompt("User Name: ");
    apiKey = await prompt("API Key (plaintext): ");
  }

  if (!id || !name || !apiKey) {
    console.error("Error: id, name, and apiKey are required");
    process.exit(1);
  }

  console.log("\nHashing API key...");
  const hashedKey = await bcrypt.hash(apiKey, 10);

  const dir = path.dirname(USERS_FILE);
  await mkdir(dir, { recursive: true });

  let users: User[] = [];
  if (await fileExists(USERS_FILE)) {
    const content = await readFile(USERS_FILE, "utf-8");
    const config: UsersConfig = JSON.parse(content);
    users = config.users;

    const existing = users.find((u) => u.id === id);
    if (existing) {
      console.log(`User "${id}" already exists. Updating...`);
    }
  }

  const newUser: User = {
    id,
    name,
    apiKey: hashedKey,
    permissions: {
      global: "none",
      users: [{ SELF: "write" }],
      projects: [],
      domain: "none",
    },
  };

  const existingIndex = users.findIndex((u) => u.id === id);
  if (existingIndex >= 0) {
    users[existingIndex] = newUser;
  } else {
    users.push(newUser);
  }

  const config: UsersConfig = { users };
  await writeFile(USERS_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log(`\nUser "${name}" (${id}) created successfully!`);
  console.log("\n⚠️  IMPORTANT: Set permissions in the users.json file before the user can access any memories.");
}

main().catch(console.error);
