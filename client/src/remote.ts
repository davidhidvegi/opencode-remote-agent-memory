import { z } from "zod";

import type { MemoryBlock, MemoryScope, MemoryStore } from "./memory";
import { isSpecialScope } from "./memory";
import { getDefaultDescription } from "./letta";
import type { JournalEntry, JournalStore } from "./journal";

export type MemoryError = {
  message: string;
  code: "CONNECTION_ERROR" | "AUTH_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "UNKNOWN";
  scope?: string;
  label?: string;
};

export type JournalError = {
  message: string;
  code: "CONNECTION_ERROR" | "AUTH_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "UNKNOWN";
};

const RemoteBlockSchema = z.looseObject({
  scope: z.enum(["global", "user", "domain"]),
  label: z.string().min(1),
  description: z.string().optional(),
  limit: z.number().int().positive().optional(),
  read_only: z.boolean().optional(),
  value: z.string().optional(),
  last_modified: z.string().optional(),
});

const RemoteJournalEntrySchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  project: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  agent: z.string().optional(),
  sessionId: z.string().optional(),
  created: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const RemoteSearchResultSchema = z.looseObject({
  entries: z.array(RemoteJournalEntrySchema),
  total: z.number(),
  allTags: z.array(z.string()),
});

type RemoteBlock = z.infer<typeof RemoteBlockSchema>;
type RemoteJournalEntry = z.infer<typeof RemoteJournalEntrySchema>;

function parseRemoteBlock(block: RemoteBlock, scope: string): MemoryBlock {
  const resolvedScope = block.scope ?? (isSpecialScope(scope) ? scope : "project");
  return {
    scope: resolvedScope,
    label: block.label,
    description: block.description?.trim() ?? getDefaultDescription(block.label),
    limit: block.limit ?? 5000,
    readOnly: block.read_only ?? false,
    value: block.value ?? "",
    filePath: "",
    lastModified: block.last_modified ? new Date(block.last_modified) : new Date(),
  };
}

function parseRemoteJournalEntry(entry: RemoteJournalEntry): JournalEntry {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    project: entry.project ?? "",
    model: entry.model ?? "",
    provider: entry.provider ?? "",
    agent: entry.agent ?? "",
    sessionId: entry.sessionId ?? "",
    created: entry.created ? new Date(entry.created) : new Date(),
    tags: entry.tags ?? [],
    filePath: "",
  };
}

function stableSortBlocks(blocks: MemoryBlock[]): MemoryBlock[] {
  const scopeOrder: Record<MemoryScope, number> = {
    global: 0,
    user: 1,
    project: 2,
    domain: 3,
  };

  blocks.sort((a, b) => {
    const orderA = scopeOrder[a.scope] ?? 10;
    const orderB = scopeOrder[b.scope] ?? 10;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });

  return blocks;
}

type ErrorCode = "CONNECTION_ERROR" | "AUTH_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "UNKNOWN";

type ErrorState = {
  message: string;
  code: ErrorCode;
};

abstract class BaseRemoteStore<T extends ErrorState> {
  protected baseUrl: string;
  protected apiKey: string;
  protected lastError: T | null = null;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  abstract getLastError(): T | null;
  abstract clearError(): void;

  protected async request<R>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<R> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        if (response.status === 401) {
          this.setError("Authentication failed. Check your API key.", "AUTH_ERROR");
        } else if (response.status === 403) {
          this.setError("Permission denied.", "FORBIDDEN");
        } else if (response.status === 404) {
          this.setError(`Not found: ${path}`, "NOT_FOUND");
        } else {
          this.setError(`${response.status} ${response.statusText} - ${error}`, "UNKNOWN");
        }
        throw new Error(this.lastError!.message);
      }

      if (response.status === 204) {
        return undefined as R;
      }

      return response.json() as Promise<R>;
    } catch (err) {
      if (this.lastError) {
        throw err;
      }
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("fetch") || errorMsg.includes("timeout")) {
        this.setError(`Cannot connect to memory server at ${this.baseUrl}`, "CONNECTION_ERROR");
      } else {
        this.setError(errorMsg, "UNKNOWN");
      }
      throw err;
    }
  }

  protected setError(message: string, code: ErrorCode): void {
    this.lastError = { message, code } as T;
  }
}

export class RemoteMemoryStore extends BaseRemoteStore<MemoryError> implements MemoryStore {
  private project: string;

  constructor(baseUrl: string, apiKey: string, project: string) {
    super(baseUrl, apiKey);
    this.project = project;
  }

  getLastError(): MemoryError | null {
    return this.lastError;
  }

  clearError(): void {
    this.lastError = null;
  }

  private getScopePath(scope: MemoryScope): string {
    if (isSpecialScope(scope)) {
      return `/blocks/${scope}`;
    }
    return `/blocks/${this.project}`;
  }

  async listBlocks(scope: MemoryScope | "all" | "domain"): Promise<MemoryBlock[]> {
    let scopesToFetch: string[];

    if (scope === "all") {
      scopesToFetch = ["global", "user", this.project];
    } else if (scope === "domain") {
      scopesToFetch = ["domain"];
    } else if (isSpecialScope(scope)) {
      scopesToFetch = [scope];
    } else {
      scopesToFetch = [this.project];
    }

    const allBlocks: MemoryBlock[] = [];

    for (const s of scopesToFetch) {
      try {
        const path = `/blocks/${s}`;
        const blocks = await this.request<RemoteBlock[]>("GET", path);
        for (const block of blocks) {
          allBlocks.push(parseRemoteBlock(block, s));
        }
      } catch {
        // Server may return error if no blocks exist - skip silently
      }
    }

    const filteredBlocks = scope === "domain"
      ? allBlocks
      : allBlocks.filter(b => b.scope !== "domain");

    return stableSortBlocks(filteredBlocks);
  }

  async getBlock(scope: MemoryScope, label: string): Promise<MemoryBlock> {
    const path = this.getScopePath(scope);
    const block = await this.request<RemoteBlock>(
      "GET",
      `${path}/${encodeURIComponent(label)}`,
    );
    return parseRemoteBlock(block, scope);
  }

  async setBlock(
    scope: MemoryScope,
    label: string,
    value: string,
    opts?: { description?: string; limit?: number },
  ): Promise<void> {
    const path = this.getScopePath(scope);
    await this.request<void>("POST", `${path}/${encodeURIComponent(label)}`, {
      value,
      description: opts?.description,
      limit: opts?.limit,
    });
  }

  async replaceInBlock(
    scope: MemoryScope,
    label: string,
    oldText: string,
    newText: string,
  ): Promise<void> {
    const path = this.getScopePath(scope);
    await this.request<void>("PATCH", `${path}/${encodeURIComponent(label)}`, {
      old_text: oldText,
      new_text: newText,
    });
  }
}

export class RemoteJournalStore extends BaseRemoteStore<JournalError> implements JournalStore {
  getLastError(): JournalError | null {
    return this.lastError;
  }

  clearError(): void {
    this.lastError = null;
  }

  async write(entry: {
    title: string;
    body: string;
    project?: string;
    model?: string;
    provider?: string;
    agent?: string;
    sessionId?: string;
    tags?: string[];
  }): Promise<JournalEntry> {
    const remoteEntry = await this.request<RemoteJournalEntry>("POST", "/journal", entry);
    return parseRemoteJournalEntry(remoteEntry);
  }

  async read(id: string): Promise<JournalEntry> {
    const remoteEntry = await this.request<RemoteJournalEntry>(
      "GET",
      `/journal/${encodeURIComponent(id)}`
    );
    return parseRemoteJournalEntry(remoteEntry);
  }

  async search(query: {
    text?: string;
    project?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ entries: JournalEntry[]; total: number; allTags: string[] }> {
    const params = new URLSearchParams();
    if (query.text) params.set("text", query.text);
    if (query.project) params.set("project", query.project);
    if (query.tags && query.tags.length > 0) params.set("tags", query.tags.join(","));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.offset) params.set("offset", String(query.offset));

    const path = `/journal${params.toString() ? "?" + params.toString() : ""}`;
    const result = await this.request<z.infer<typeof RemoteSearchResultSchema>>("GET", path);

    return {
      entries: result.entries.map(parseRemoteJournalEntry),
      total: result.total,
      allTags: result.allTags,
    };
  }
}

export function createRemoteMemoryStore(baseUrl: string, apiKey: string, project: string): MemoryStore {
  return new RemoteMemoryStore(baseUrl, apiKey, project);
}

export function createRemoteJournalStore(baseUrl: string, apiKey: string): JournalStore {
  return new RemoteJournalStore(baseUrl, apiKey);
}
