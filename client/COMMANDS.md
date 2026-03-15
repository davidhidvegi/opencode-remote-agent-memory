# OpenCode Commands

Depending on your projects and memory structure needs you might want to add custom [OpenCode commands](https://opencode.ai/docs/commands/) to manually instruct the agent to capture memory or journal notes. Here are 2 examples for that:

## Capture Memory

```markdown
---
description: Capture session knowledge to memory
---

Analyze the current session to identify and retain new knowledge. Cross-reference findings with your existing memory blocks and perform necessary updates to ensure your long-term memory remains accurate and up-to-date.

Action Guidelines:
1. Update Existing Blocks: If a topic or fact has changed or been clarified, use `memory_replace` to update the relevant block.
2. Create New Blocks: If a significant new concept, pattern, or preference has emerged, use `memory_set` to create a new block with an appropriate scope.
3. Synthesis: Do not simply append text. Consolidate knowledge to keep blocks concise, high-signal, and easy to read.

Scope Guidance:
- Global: General heuristics or facts applicable everywhere.
- User: Personal preferences, constraints, and communication style.
- Project: Architectural decisions, tech stack details, and codebase context.
- Domain: Specialized technical knowledge or tool usage reusable across projects (e.g., "Docker volume mounting syntax," "Elixir debugging patterns"). Create domain blocks when you discover non-project-specific insights that would be useful in future sessions involving this technology.

Ensure your memory blocks reflect the current state of understanding before ending the session.

Result Reporting:
Once all memory updates are complete, provide a short summary listing the blocks you created or updated and the key knowledge persisted.
```

## Write Journal

```markdown
---
description: Write a journal based on the current session
---

Reflect on the current session to capture experiential knowledge and significant observations. Use `journal_write` to create a new journal entry preserving anything meaningful that might aid future interactions.

Content Guidelines:
1. Insights & Solutions: Record successful strategies, tool usage patterns, and "aha!" moments.
2. Difficulties & Roadblocks: Note key challenges, confusing error messages, or friction points—even if they were not fully solved. These context markers are vital for debugging future issues.
3. General Observations: Capture any thought, idea, or nuance that seems important, relevant, or worth remembering for later, even if it doesn't fit a specific category. If you think "I might need this later," write it down.
4. Conciseness: Avoid fluff; focus on high-signal content.

Tagging Strategy:
Assign tags to maximize retrievability. Combine action tags (e.g., #debugging, #setup, #failed-attempt) with technology tags (e.g., #docker, #react). Ask yourself: "What keywords would I use to search for this context in 6 months?"

Result Reporting:
Once the entry is written, provide a short summary of what was added to the journal.
```
