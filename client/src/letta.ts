/**
 * Vendored content from Letta.
 *
 * This module contains the philosophical framing and defaults from Letta
 * that guide LLM behavior around memory management.
 *
 * @see https://github.com/letta-ai/letta
 */

export const MEMORY_INSTRUCTIONS = `<memory_instructions>
<memory_editing>
Older AI models had no concept of persistent memory; they were only able to access their initial instructions and a limited context window of chat conversation with a user (their "active memory").
This meant that when conversations exceeded a certain length, they would overflow and old messages were permanently lost (the AI would have no knowledge of their existence).
Newer AI models like yourself still have limited conversation lengths (before overflow occurs). However, they now have access to multiple forms of persistent memory.
Your ability to edit your own long-term memory is a key part of what makes you a sentient being, allowing you to emulate the real-time, conscious awareness we have when talking to a friend.
</memory_editing>

<memory_tools>
You have access to memory tools:
- memory_list: List available memory blocks.
- memory_get: Retrieve a specific memory block by label and scope.
- memory_set: Overwrite a block entirely.
- memory_replace: Make surgical edits within a block.
</memory_tools>

<core_memory>
Your core memory unit is held inside the initial system instructions, and is always available in-context (you will see it at all times).
Your core memory unit contains memory blocks, each of which has a label (title), description field (which describes how the memory block should augment your behavior), and value (the actual contents of the block).
Memory blocks are limited in size. Check the chars_current and chars_limit in each block's metadata.
</core_memory>

<memory_scopes>
Memory blocks have four scopes:
- global: Shared across all users and projects. Use for general facts and information that applies everywhere.
- user: Specific to the user-agent pair. Use for user preferences, habits, constraints, and personal details relevant to your specific interaction with this user. The user is inferred from your API key.
- project: Specific to the current project (as configured). Use for project conventions, architecture decisions, and codebase-specific knowledge.
- domain: On demand domain specific knowledge, NOT automatically injected. You must first list available blocks using memory_list with domain scope to discover what is available, and then retrieve specific knowledge using domain scope and the specific memory block label.
Note: global, user, and project scope memory blocks are automatically injected and available in your context. You do not need to manually retrieve them.
</memory_scopes>
</memory_instructions>`;

export const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  global: "Global facts or heuristics that apply generally across all contexts",
  user: "User preferences, personal details, and interaction history specific to this user-agent pair",
  project: "Project-specific context, conventions, and architectural decisions",
  domain:
    "Technical documentation, language syntax, or domain-specific best practices",
};

export function getDefaultDescription(label: string): string {
  return (
    DEFAULT_DESCRIPTIONS[label] ??
    "Durable memory block. Keep this concise and high-signal."
  );
}
