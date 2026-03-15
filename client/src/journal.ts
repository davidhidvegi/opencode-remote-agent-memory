import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { z } from "zod";

const TagSchema = z.looseObject({
  name: z.string().min(1),
  description: z.string().min(1),
});

const ConfigSchema = z.looseObject({
  journal: z
    .looseObject({
      enabled: z.boolean().optional(),
      tags: z.array(TagSchema).optional(),
    })
    .optional(),
  remote: z.looseObject({
    url: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
  }),
});

export type AgentMemoryConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(
  projectDirectory: string = "",
): Promise<Required<AgentMemoryConfig>> {
  const globalConfigPath = path.join(
    os.homedir(),
    ".config",
    "opencode",
    "agent-memory.json",
  );
  const projectConfigPath = projectDirectory
    ? path.join(projectDirectory, ".opencode", "agent-memory.json")
    : null;

  let globalConfig: Partial<AgentMemoryConfig> = {};
  let projectConfig: Partial<AgentMemoryConfig> = {};

  try {
    const raw = await fs.readFile(globalConfigPath, "utf-8");
    const parsed = ConfigSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      globalConfig = parsed.data;
    }
  } catch {
    // Global config not found or invalid - that's ok, we'll use project config
  }

  if (projectConfigPath) {
    try {
      const raw = await fs.readFile(projectConfigPath, "utf-8");
      const parsed = ConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        projectConfig = parsed.data;
      }
    } catch {
      // Project config not found - that's ok
    }
  }

  const merged: Required<AgentMemoryConfig> = {
    remote: {
      url: (projectConfig.remote?.url ??
        globalConfig.remote?.url ??
        "") as string,
      apiKey: (projectConfig.remote?.apiKey ??
        globalConfig.remote?.apiKey ??
        "") as string,
      project: (projectConfig.remote?.project ??
        globalConfig.remote?.project ??
        "") as string,
    },
    journal: (projectConfig.journal ??
      globalConfig.journal) as Required<AgentMemoryConfig>["journal"],
  };

  if (!merged.remote.url || !merged.remote.apiKey || !merged.remote.project) {
    throw new Error(
      "Remote memory configuration required. Add 'remote.url', 'remote.apiKey', and 'remote.project' to " +
        (projectConfigPath ? `${projectConfigPath} or ` : "") +
        globalConfigPath,
    );
  }

  return merged;
}

export type JournalTag = {
  name: string;
  description: string;
};

export type JournalEntry = {
  id: string;
  title: string;
  project: string;
  model: string;
  provider: string;
  agent: string;
  sessionId: string;
  created: Date;
  tags: string[];
  body: string;
  filePath: string;
};

export type JournalStore = {
  write(entry: {
    title: string;
    body: string;
    project?: string;
    model?: string;
    provider?: string;
    agent?: string;
    sessionId?: string;
    tags?: string[];
  }): Promise<JournalEntry>;

  read(id: string): Promise<JournalEntry>;

  search(query: {
    text?: string;
    project?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ entries: JournalEntry[]; total: number; allTags: string[] }>;
};

export function buildJournalSystemNote(tags?: readonly JournalTag[]): string {
  const tagSection =
    tags && tags.length > 0
      ? `\nExamples:\n${tags.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`
      : "";

  return `<journal_instructions>
<journal_purpose>
You have access to a private, append-only journal for experiential learning and self-improvement.
Unlike memory blocks (which are concise, domain-specific references that are updated), the journal is a persistent history of your actions, reasoning, and discoveries. It allows you to learn from past mistakes and successes across sessions.
</journal_purpose>
<journal_content>
Record entries to persist insights that might be useful in the future. The journal is append-only; do not delete or overwrite previous entries.
Good candidates for journal entries include:
- Solutions: Specific steps or reasoning that successfully solved a complex problem.
- Failures: Approaches that did not work or errors encountered, helping you avoid repeating mistakes.
- Learnings: Key decisions, architectural insights, or "aha!" moments that clarified a confusing concept.
- Context: Notes on user preferences, project constraints, or general observations discovered through interaction.
</journal_content>
<journal_tags>
Tags are free-form strings used to classify entries for easier retrieval. Use them to organize your journal effectively.${tagSection}
</journal_tags>
<journal_workflow>
- Before starting complex tasks: Use journal_search to find relevant past entries semantically.
- Retrieval Strategy:
  1. Read the single most relevant entry first.
  2. If it is not helpful, stop reading and proceed with your current context.
  3. If it IS helpful (offering a solution, a shortcut, or a warning of a failed approach), read 1-2 additional relevant entries to build a broader context.
- Goal: Leverage past experience to solve issues faster or learn how NOT to approach a problem.
The journal is global across all projects, but each entry automatically records the project context from which it was written.
</journal_workflow>
</journal_instructions>`;
}
