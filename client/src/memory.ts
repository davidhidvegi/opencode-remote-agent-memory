export type MemoryScope = "global" | "user" | "project" | "domain";

export const SPECIAL_SCOPES = ["global", "user", "domain"] as const;

export function isSpecialScope(scope: string): scope is MemoryScope {
  return (SPECIAL_SCOPES as readonly string[]).includes(scope);
}

export type MemoryBlock = {
  scope: MemoryScope;
  label: string;
  description: string;
  limit: number;
  readOnly: boolean;
  value: string;
  filePath: string;
  lastModified: Date;
};

export type MemoryError = {
  message: string;
  code:
    | "CONNECTION_ERROR"
    | "AUTH_ERROR"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "UNKNOWN";
  scope?: string;
  label?: string;
};

export type MemoryStore = {
  listBlocks(scope: MemoryScope | "all" | "domain"): Promise<MemoryBlock[]>;
  getBlock(scope: MemoryScope, label: string): Promise<MemoryBlock>;
  setBlock(
    scope: MemoryScope | string,
    label: string,
    value: string,
    opts?: { description?: string; limit?: number },
  ): Promise<void>;
  replaceInBlock(
    scope: MemoryScope | string,
    label: string,
    oldText: string,
    newText: string,
  ): Promise<void>;
  getLastError(): MemoryError | null;
  clearError(): void;
};
