import type { Plugin, ToolDefinition } from "@opencode-ai/plugin";

import {
  buildJournalSystemNote,
  loadConfig,
} from "./journal";
import { createRemoteMemoryStore, createRemoteJournalStore } from "./remote";
import type { MemoryError } from "./remote";
import { renderMemoryBlocks } from "./prompt";
import {
  JournalRead,
  JournalSearch,
  JournalWrite,
  MemoryGet,
  MemoryList,
  MemoryReplace,
  MemorySet,
} from "./tools";
import type { JournalContext } from "./tools";

function getSystemErrorWarning(error: MemoryError | null): string {
  if (!error) return "";
  
  switch (error.code) {
    case "CONNECTION_ERROR":
      return `\n\n<memory_warning>
⚠️ Memory server unavailable. Memories cannot be loaded. Please check that the memory server is running.
</memory_warning>`;
    case "AUTH_ERROR":
      return `\n\n<memory_warning>
⚠️ Memory authentication failed. Check your API key configuration.
</memory_warning>`;
    case "FORBIDDEN":
      return `\n\n<memory_warning>
⚠️ Memory permission denied. ${error.message}
</memory_warning>`;
    default:
      return `\n\n<memory_warning>
⚠️ Memory error: ${error.message}
</memory_warning>`;
  }
}

export const MemoryPlugin: Plugin = async (input) => {
  const directory = (input as { directory?: string }).directory ?? "";
  const config = await loadConfig(directory);

  const store = createRemoteMemoryStore(
    config.remote.url!,
    config.remote.apiKey!,
    config.remote.project!
  );

  const journalEnabled = config.journal?.enabled === true;

  // Mutable state updated by chat.message hook
  const journalCtx: JournalContext = {
    directory,
    model: "",
    provider: "",
  };

  let journalTools: Record<string, ToolDefinition> = {};
  let journalSystemNote = "";

  if (journalEnabled) {
    const journalStore = createRemoteJournalStore(
      config.remote.url!,
      config.remote.apiKey!
    );
    journalTools = {
      journal_write: JournalWrite(journalStore, journalCtx),
      journal_read: JournalRead(journalStore),
      journal_search: JournalSearch(journalStore),
    };
    journalSystemNote = buildJournalSystemNote(config.journal?.tags);
  }

  return {
    "chat.message": async (input, _output) => {
      if (input.model) {
        journalCtx.model = input.model.modelID;
        journalCtx.provider = input.model.providerID;
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const blocks = await store.listBlocks("all");
      const error = store.getLastError?.() ?? null;
      
      // If we got blocks, show them. Otherwise, just show the error warning.
      const xml = renderMemoryBlocks(blocks);
      const errorWarning = getSystemErrorWarning(error);
      
      if (!xml && errorWarning) {
        output.system.push(errorWarning);
        return;
      }
      
      if (!xml) return;

      // Insert early (right after provider header) for salience.
      // OpenCode will re-join system chunks to preserve caching.
      const insertAt = output.system.length > 0 ? 1 : 0;
      output.system.splice(insertAt, 0, xml);

      // Append error warning if there was an error loading memories
      if (errorWarning) {
        output.system.push(errorWarning);
      }

      // Append journal instructions at the end (preserves memory block cache)
      if (journalSystemNote) {
        output.system.push(journalSystemNote);
      }
    },

    tool: {
      memory_get: MemoryGet(store),
      memory_list: MemoryList(store),
      memory_set: MemorySet(store),
      memory_replace: MemoryReplace(store),
      ...journalTools,
    },
  };
};
