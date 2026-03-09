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
      ? `\n\nSuggested tags:\n${tags.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`
      : "";

  return `<journal_instructions>
You have access to a private journal. Use it to record thoughts, discoveries, and decisions as you work.
Tags are free-form strings — use them to classify entries however makes sense.${tagSection}

Before starting complex tasks, search the journal for relevant past context.
Use journal_search to find past entries semantically, and journal_read to read a specific entry.
The journal is global across all projects but each entry records which project it was written from.
</journal_instructions>`;
}
