import * as fs from "node:fs/promises";
import * as path from "node:path";
import { setBlock } from "./memory.js";
import { writeJournalEntry } from "./journal.js";
import { createUser } from "../add-user.js";

const MEMORY_DIR = process.env.MEMORY_DIR || "./data/memory";
const USERS_FILE = process.env.USERS_FILE || "./data/users.json";

async function hasMarkdownFiles(dir: string): Promise<boolean> {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    return files.some((f) => f.isFile() && f.name.endsWith(".md"));
  } catch {
    return false;
  }
}

async function hasJournalEntries(userId: string): Promise<boolean> {
  const journalDir = path.join(MEMORY_DIR, "users", userId, "journal");
  try {
    const files = await fs.readdir(journalDir, { withFileTypes: true });
    return files.some((f) => f.isFile() && f.name.endsWith(".md"));
  } catch {
    return false;
  }
}

export async function initializeMemory(
  userId: string = "guest",
  projectName: string = "default",
): Promise<void> {
  const globalDir = path.join(MEMORY_DIR, "global");
  const userDir = path.join(MEMORY_DIR, "users", userId);
  const domainDir = path.join(MEMORY_DIR, "domain");
  const projectDir = path.join(MEMORY_DIR, "projects", projectName);

  const hasGlobal = await hasMarkdownFiles(globalDir);
  const hasUser = await hasMarkdownFiles(userDir);
  const hasDomain = await hasMarkdownFiles(domainDir);
  const hasProject = await hasMarkdownFiles(projectDir);

  if (hasGlobal || hasUser || hasDomain || hasProject) {
    console.log("Memory already initialized, skipping...");
    return;
  }

  console.log("Initializing default memory blocks...");

  await setBlock("global", "persona", "Be concise, direct, and to the point.", {
    description: "How the agent should behave and respond",
    limit: 2000,
  });

  await setBlock(
    "user",
    "bio",
    "- Name: User\n- Preferences: Default",
    {
      description: "Personal details about the user",
      limit: 2000,
    },
    userId,
  );

  await setBlock("domain", "default", "Domain knowledge placeholder", {
    description: "General domain knowledge",
    limit: 2000,
  });

  await setBlock(
    "project",
    "project",
    "- Project: Default project\n- Purpose: Initial setup",
    {
      description: "Project-specific information",
      limit: 5000,
    },
    projectName,
  );

  const hasJournal = await hasJournalEntries(userId);
  if (!hasJournal) {
    await writeJournalEntry(userId, {
      title: "Initial setup",
      body: "Memory system initialized with default blocks.",
      tags: ["setup", "init"],
    });
  }

  console.log("Memory initialization complete.");
}

export async function initializeDefaultUser(
  defaultUser: string,
  defaultPassword: string,
): Promise<void> {
  try {
    await fs.access(USERS_FILE);
    console.log("Users file already exists, skipping default user creation.");
    return;
  } catch {}

  console.log("Creating default guest user...");
  await createUser(defaultUser, defaultUser, defaultPassword);
}
