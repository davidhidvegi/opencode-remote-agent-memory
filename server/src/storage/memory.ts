import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import * as path from "node:path";
import type { MemoryBlock, MemoryScope } from "../types.js";
import { parseFrontmatter, buildFrontmatter } from "./utils.js";

const MEMORY_DIR = process.env.MEMORY_DIR || "./data/memory";

const SPECIAL_SCOPES = ["global", "user", "domain"] as const;

export function isSpecialScope(scope: string): scope is "global" | "user" | "domain" {
  return (SPECIAL_SCOPES as readonly string[]).includes(scope);
}

function getBlockDir(scope: MemoryScope, identifier?: string): string {
  if (scope === "global") {
    return path.join(MEMORY_DIR, "global");
  }
  if (scope === "user" && identifier) {
    return path.join(MEMORY_DIR, "users", identifier);
  }
  if (scope === "project" && identifier) {
    return path.join(MEMORY_DIR, "projects", identifier);
  }
  if (scope === "domain") {
    return path.join(MEMORY_DIR, "domain");
  }
  throw new Error(`Invalid scope or missing identifier: ${scope}`);
}

function blockFromFile(dir: string, fileName: string, scope: MemoryScope): Promise<MemoryBlock> {
  const filePath = path.join(dir, fileName);
  return fs.readFile(filePath, "utf-8").then((content) => {
    const { frontmatter, body } = parseFrontmatter(content);
    const label = fileName.replace(/\.md$/, "");
    return {
      scope,
      label,
      description: (frontmatter.description as string) || getDefaultDescription(label),
      limit: (frontmatter.limit as number) || 5000,
      readOnly: (frontmatter.read_only as boolean) || false,
      value: body,
      lastModified: new Date(),
    };
  });
}

async function getBlockStat(filePath: string): Promise<Date> {
  const stat = await fs.stat(filePath);
  return stat.mtime;
}

export async function listBlocks(scope: MemoryScope, identifier?: string): Promise<MemoryBlock[]> {
  const dir = getBlockDir(scope, identifier);
  
  let files: Dirent[];
  try {
    files = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const blocks: MemoryBlock[] = [];

  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".md")) continue;
    
    const block = await blockFromFile(dir, file.name, scope);
    block.lastModified = await getBlockStat(path.join(dir, file.name));
    blocks.push(block);
  }

  return blocks;
}

export async function getBlock(scope: MemoryScope, label: string, identifier?: string): Promise<MemoryBlock> {
  const dir = getBlockDir(scope, identifier);
  const block = await blockFromFile(dir, `${label}.md`, scope);
  block.lastModified = await getBlockStat(path.join(dir, `${label}.md`));
  return block;
}

export async function setBlock(
  scope: MemoryScope,
  label: string,
  value: string,
  opts?: { description?: string; limit?: number; readOnly?: boolean },
  identifier?: string
): Promise<void> {
  const dir = getBlockDir(scope, identifier);
  await fs.mkdir(dir, { recursive: true });
  
  const filePath = path.join(dir, `${label}.md`);
  
  let existing: MemoryBlock | undefined;
  try {
    existing = await getBlock(scope, label, identifier);
  } catch {}
  
  if (existing?.readOnly) {
    throw new Error(`Memory block is read-only: ${scope}:${label}`);
  }
  
  const frontmatter: Record<string, unknown> = {
    label,
    description: opts?.description ?? existing?.description ?? "",
    limit: opts?.limit ?? existing?.limit ?? 5000,
    read_only: opts?.readOnly ?? existing?.readOnly ?? false,
  };
  
  const content = `${buildFrontmatter(frontmatter)}\n${value}`;
  await fs.writeFile(filePath, content, "utf-8");
}

export async function replaceInBlock(
  scope: MemoryScope,
  label: string,
  oldText: string,
  newText: string,
  identifier?: string
): Promise<void> {
  const block = await getBlock(scope, label, identifier);
  
  if (block.readOnly) {
    throw new Error(`Memory block is read-only: ${scope}:${label}`);
  }
  
  if (!block.value.includes(oldText)) {
    throw new Error(`Old text not found in ${scope}:${label}`);
  }
  
  const newValue = block.value.replace(oldText, newText);
  
  await setBlock(scope, label, newValue, {
    description: block.description,
    limit: block.limit,
    readOnly: block.readOnly,
  }, identifier);
}

function getDefaultDescription(label: string): string {
  const defaults: Record<string, string> = {
    persona: "The persona block: Stores details about your current persona, guiding how you behave and respond.",
    human: "The human block: Stores key details about the person you are conversing with.",
    project: "The project block: Stores durable, high-signal information about this codebase.",
    domain: "The domain block: Stores specific domain knowledge.",
  };
  return defaults[label] || "Durable memory block. Keep this concise and high-signal.";
}
