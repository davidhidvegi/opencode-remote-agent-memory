import { tool } from "@opencode-ai/plugin";

import type { JournalStore } from "./journal";
import type { MemoryError, MemoryScope, MemoryStore } from "./memory";

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getErrorMessage(store: MemoryStore): string | null {
  const error = store.getLastError?.();
  if (!error) return null;

  switch (error.code) {
    case "CONNECTION_ERROR":
      return `⚠️ Memory server unavailable. Cannot connect to server. Check that the server is running.`;
    case "AUTH_ERROR":
      return `⚠️ Memory authentication failed. Check your API key.`;
    case "FORBIDDEN":
      return `⚠️ Memory permission denied. ${error.message}`;
    case "NOT_FOUND":
      return `⚠️ Memory not found. ${error.message}`;
    default:
      return `⚠️ Memory error. ${error.message}`;
  }
}

export function MemoryList(store: MemoryStore) {
  return tool({
    description: "List available memory blocks (labels, descriptions, sizes). Use scope='domain' to retrieve domain knowledge on-demand.",
    args: {
      scope: tool.schema.enum(["all", "global", "user", "project", "domain"]).optional(),
    },
    async execute(args) {
      const scope = (args.scope ?? "all") as MemoryScope | "all" | "domain";
      const blocks = await store.listBlocks(scope);
      
      const errorMsg = getErrorMessage(store);
      if (blocks.length === 0) {
        if (errorMsg) {
          return `${errorMsg}\n\nNo memory blocks available.`;
        }
        return "No memory blocks found.";
      }

      const blockList = blocks
        .map(
          (b) =>
            `${b.scope}:${b.label}\n  read_only=${b.readOnly} chars=${b.value.length}/${b.limit}\n  ${b.description}`,
        )
        .join("\n\n");

      if (errorMsg) {
        return `${errorMsg}\n\n${blockList}`;
      }
      return blockList;
    },
  });
}

export function MemoryGet(store: MemoryStore) {
  return tool({
    description: "Get a specific memory block by label and scope.",
    args: {
      label: tool.schema.string(),
      scope: tool.schema.enum(["global", "user", "project", "domain"]).optional(),
    },
    async execute(args) {
      const scope = (args.scope ?? "project") as MemoryScope;
      const label = scope === "user" ? toKebabCase(args.label) : args.label;
      try {
        const block = await store.getBlock(scope, label);
        return `<${block.label}>
<description>
${block.description}
</description>
<metadata>
- chars_current=${block.value.length}
- chars_limit=${block.limit}
- read_only=${block.readOnly}
- scope=${block.scope}
</metadata>
<value>
${block.value}
</value>`;
      } catch (err) {
        const errorMsg = getErrorMessage(store);
        if (errorMsg) {
          return errorMsg;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("not found")) {
          return `⚠️ Memory block '${args.label}' not found in scope '${scope}'.`;
        }
        return `⚠️ Failed to get memory block: ${msg}`;
      }
    },
  });
}

export function MemorySet(store: MemoryStore) {
  return tool({
    description: "Create or update a memory block (full overwrite).",
    args: {
      label: tool.schema.string(),
      scope: tool.schema.enum(["global", "user", "project", "domain"]).optional(),
      value: tool.schema.string(),
      description: tool.schema.string().optional(),
      limit: tool.schema.number().int().positive().optional(),
    },
    async execute(args) {
      // Default to "project" for mutations (safer default)
      const scope = (args.scope ?? "project") as MemoryScope;
      const label = scope === "user" ? toKebabCase(args.label) : args.label;
      try {
        await store.setBlock(scope, label, args.value, {
          description: args.description,
          limit: args.limit,
        });
        return `Updated memory block ${scope}:${label}.`;
      } catch (err) {
        const errorMsg = getErrorMessage(store);
        if (errorMsg) {
          return errorMsg;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        return `⚠️ Failed to set memory block: ${msg}`;
      }
    },
  });
}

export function MemoryReplace(store: MemoryStore) {
  return tool({
    description: "Replace a substring within a memory block.",
    args: {
      label: tool.schema.string(),
      scope: tool.schema.enum(["global", "user", "project", "domain"]).optional(),
      oldText: tool.schema.string(),
      newText: tool.schema.string(),
    },
    async execute(args) {
      // Default to "project" for mutations (safer default)
      const scope = (args.scope ?? "project") as MemoryScope;
      const label = scope === "user" ? toKebabCase(args.label) : args.label;
      try {
        await store.replaceInBlock(scope, label, args.oldText, args.newText);
        return `Updated memory block ${scope}:${label}.`;
      } catch (err) {
        const errorMsg = getErrorMessage(store);
        if (errorMsg) {
          return errorMsg;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        return `⚠️ Failed to replace in memory block: ${msg}`;
      }
    },
  });
}

export type JournalContext = {
  directory: string;
  model: string;
  provider: string;
};

export function JournalWrite(
  store: JournalStore,
  ctx: JournalContext,
) {
  return tool({
    description:
      "Write a new journal entry. Use this to capture insights, technical discoveries, " +
      "design decisions, observations, or reflections. Entries are append-only and cannot be edited. " +
      "Tags are optional comma-separated names, e.g. \"perf, debugging\".",
    args: {
      title: tool.schema.string(),
      body: tool.schema.string(),
      tags: tool.schema.string().optional(),
    },
    async execute(args, toolCtx) {
      const tags = args.tags
        ? args.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : undefined;

      const entry = await store.write({
        title: args.title,
        body: args.body,
        project: ctx.directory,
        model: ctx.model,
        provider: ctx.provider,
        agent: toolCtx.agent,
        sessionId: toolCtx.sessionID,
        tags,
      });

      return `Journal entry created: ${entry.id}\n  title: ${entry.title}\n  created: ${entry.created.toISOString()}`;
    },
  });
}

export function JournalRead(store: JournalStore) {
  return tool({
    description:
      "Read a specific journal entry by its ID. Returns the full entry " +
      "including metadata and body.",
    args: {
      id: tool.schema.string(),
    },
    async execute(args) {
      const entry = await store.read(args.id);

      const meta = [
        `title: ${entry.title}`,
        `created: ${entry.created.toISOString()}`,
        entry.project ? `project: ${entry.project}` : null,
        entry.model ? `model: ${entry.model}` : null,
        entry.provider ? `provider: ${entry.provider}` : null,
        entry.agent ? `agent: ${entry.agent}` : null,
        entry.sessionId ? `session: ${entry.sessionId}` : null,
        entry.tags.length > 0
          ? `tags: ${entry.tags.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      return `${meta}\n\n${entry.body}`;
    },
  });
}

export function JournalSearch(store: JournalStore) {
  return tool({
    description:
      "Search journal entries using semantic similarity. Returns matching entries " +
      "sorted by relevance. All filters are optional and combined with AND logic. " +
      "Use with no arguments to list recent entries. Use offset to paginate.",
    args: {
      text: tool.schema.string().optional(),
      project: tool.schema.string().optional(),
      tags: tool.schema.string().optional(),
      limit: tool.schema.number().int().positive().optional(),
      offset: tool.schema.number().int().nonnegative().optional(),
    },
    async execute(args) {
      const tags = args.tags
        ? args.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : undefined;

      const result = await store.search({
        text: args.text,
        project: args.project,
        tags,
        limit: args.limit,
        offset: args.offset,
      });

      if (result.entries.length === 0) {
        const tagsLine =
          result.allTags.length > 0
            ? `\nTags in use: ${result.allTags.join(", ")}`
            : "";
        return `No journal entries found.${tagsLine}`;
      }

      const offset = args.offset ?? 0;
      const header = `Found ${result.total} entries (showing ${offset + 1}–${offset + result.entries.length}):`;
      const tagsLine =
        result.allTags.length > 0
          ? `\nTags in use: ${result.allTags.join(", ")}`
          : "";

      const lines = result.entries.map((e) => {
        const tagStr =
          e.tags.length > 0
            ? ` [${e.tags.join(", ")}]`
            : "";
        return `${e.id}\n  ${e.title}${tagStr}\n  ${e.created.toISOString()}`;
      });

      return `${header}${tagsLine}\n\n${lines.join("\n\n")}`;
    },
  });
}
