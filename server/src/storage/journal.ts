import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import * as path from "node:path";
import type { JournalEntry, JournalSearchQuery, JournalSearchResult } from "../types.js";
import { parseFrontmatter, buildFrontmatter } from "./utils.js";

const MEMORY_DIR = process.env.MEMORY_DIR || "./data/memory";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const MODEL_DTYPE = "q8";

let pipelinePromise: Promise<any> | undefined;

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("feature-extraction", MODEL_NAME, { dtype: MODEL_DTYPE });
    })();
  }
  return pipelinePromise;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);

  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! ** 2;
    normB += b[i]! ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

function getJournalDir(userId: string) {
  return path.join(MEMORY_DIR, "users", userId, "journal");
}

function getEntryFilePath(userId: string, entryId: string) {
  return path.join(getJournalDir(userId), `${entryId}.md`);
}

function getEmbeddingFilePath(userId: string, entryId: string) {
  return path.join(getJournalDir(userId), `${entryId}.embedding`);
}

function entryFilename(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return [
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`,
    "-",
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`,
    "-",
    pad(date.getUTCMilliseconds(), 3),
  ].join("");
}

export async function writeJournalEntry(
  userId: string,
  entry: { title: string; body: string; project?: string; model?: string; provider?: string; agent?: string; sessionId?: string; tags?: string[] }
): Promise<JournalEntry> {
  const journalDir = getJournalDir(userId);
  await fs.mkdir(journalDir, { recursive: true });

  const created = new Date();
  const id = entryFilename(created);
  const filePath = getEntryFilePath(userId, id);

  const frontmatter = Object.fromEntries(
    Object.entries({
      title: entry.title,
      created: created.toISOString(),
      project: entry.project,
      model: entry.model,
      provider: entry.provider,
      agent: entry.agent,
      session_id: entry.sessionId,
      tags: entry.tags,
    }).filter(([, v]) => v !== undefined)
  );

  await fs.writeFile(filePath, `${buildFrontmatter(frontmatter)}\n${entry.body}`, "utf-8");

  const embedding = await generateEmbedding(`${entry.title}\n${entry.body}`);
  await fs.writeFile(getEmbeddingFilePath(userId, id), JSON.stringify(embedding), "utf-8");

  return { id, created: created.toISOString(), tags: entry.tags ?? [], ...entry, project: entry.project ?? "", model: entry.model ?? "", provider: entry.provider ?? "", agent: entry.agent ?? "", sessionId: entry.sessionId ?? "" };
}

export async function getJournalEntry(userId: string, entryId: string): Promise<JournalEntry> {
  const filePath = getEntryFilePath(userId, entryId);
  const content = await fs.readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  return {
    id: entryId,
    title: frontmatter.title as string || "",
    body: body.trim(),
    project: (frontmatter.project as string) ?? "",
    model: (frontmatter.model as string) ?? "",
    provider: (frontmatter.provider as string) ?? "",
    agent: (frontmatter.agent as string) ?? "",
    sessionId: (frontmatter.session_id as string) ?? "",
    created: (frontmatter.created as string) ?? "",
    tags: (frontmatter.tags as string[]) ?? [],
  };
}

async function loadEmbedding(userId: string, entryId: string): Promise<number[] | undefined> {
  const embeddingPath = getEmbeddingFilePath(userId, entryId);
  try {
    const raw = await fs.readFile(embeddingPath, "utf-8");
    return JSON.parse(raw) as number[];
  } catch {
    return undefined;
  }
}

export async function searchJournalEntries(
  userId: string,
  query: JournalSearchQuery
): Promise<JournalSearchResult> {
  const journalDir = getJournalDir(userId);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
  const offset = Math.max(query.offset ?? 0, 0);

  let files: Dirent[];
  try {
    files = await fs.readdir(journalDir, { withFileTypes: true });
  } catch {
    return { entries: [], total: 0, allTags: [] };
  }

  const mdFiles = files
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name.replace(/\.md$/, ""))
    .sort()
    .reverse();

  let queryEmbedding: number[] | undefined;
  if (query.text) {
    queryEmbedding = await generateEmbedding(query.text);
  }

  const tagSet = new Set<string>();
  const scoredEntries: { entry: JournalEntry; score: number }[] = [];

  for (const entryId of mdFiles) {
    let entry: JournalEntry;
    try {
      entry = await getJournalEntry(userId, entryId);
    } catch {
      continue;
    }

    for (const tag of entry.tags) {
      tagSet.add(tag);
    }

    if (query.project && entry.project !== query.project) {
      continue;
    }

    if (query.tags && query.tags.length > 0) {
      const entryTagNames = entry.tags.map((t) => t.toLowerCase());
      const allTagsMatch = query.tags.every((t) =>
        entryTagNames.includes(t.toLowerCase())
      );
      if (!allTagsMatch) continue;
    }

    let score = 0;

    if (query.text && queryEmbedding) {
      const entryEmbedding = await loadEmbedding(userId, entryId);
      if (entryEmbedding) {
        score = cosineSimilarity(queryEmbedding, entryEmbedding);
      } else {
        const haystack = `${entry.title}\n${entry.body}`.toLowerCase();
        score = haystack.includes(query.text.toLowerCase()) ? 0.5 : 0;
      }
      if (score <= 0) continue;
    } else if (!query.text) {
      score = new Date(entry.created).getTime();
    }

    scoredEntries.push({ entry, score });
  }

  scoredEntries.sort((a, b) => b.score - a.score);
  const total = scoredEntries.length;
  const paginated = scoredEntries.slice(offset, offset + limit);

  return {
    entries: paginated.map((e) => e.entry),
    total,
    allTags: Array.from(tagSet).sort(),
  };
}
