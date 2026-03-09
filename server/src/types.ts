import { z } from "zod";

export type PermissionLevel = "none" | "read" | "write";

export const PermissionLevelSchema = z.enum(["none", "read", "write"]);

export type UserPermissionEntry = {
  [key: string]: PermissionLevel;
};

export type UserPermissions = {
  global: PermissionLevel;
  users: UserPermissionEntry[];
  projects: UserPermissionEntry[];
  domain: PermissionLevel;
};

export const UserPermissionsSchema = z.object({
  global: PermissionLevelSchema,
  users: z.array(z.record(z.string(), PermissionLevelSchema)),
  projects: z.array(z.record(z.string(), PermissionLevelSchema)),
  domain: PermissionLevelSchema,
});

export type User = {
  id: string;
  name: string;
  apiKey: string;
  permissions: UserPermissions;
};

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiKey: z.string(),
  permissions: UserPermissionsSchema,
});

export type UsersConfig = {
  users: User[];
};

export const UsersConfigSchema = z.object({
  users: z.array(UserSchema),
});

export type MemoryScope = "global" | "user" | "project" | "domain";

export type MemoryBlock = {
  scope: MemoryScope;
  label: string;
  description: string;
  limit: number;
  readOnly: boolean;
  value: string;
  lastModified: Date;
};

export type CreateBlockRequest = {
  value: string;
  description?: string;
  limit?: number;
};

export type ReplaceBlockRequest = {
  old_text: string;
  new_text: string;
};

export type JournalEntry = {
  id: string;
  title: string;
  body: string;
  project: string;
  model: string;
  provider: string;
  agent: string;
  sessionId: string;
  created: string;
  tags: string[];
};

export type CreateJournalRequest = {
  title: string;
  body: string;
  project?: string;
  model?: string;
  provider?: string;
  agent?: string;
  sessionId?: string;
  tags?: string[];
};

export type JournalSearchQuery = {
  text?: string;
  project?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
};

export type JournalSearchResult = {
  entries: JournalEntry[];
  total: number;
  allTags: string[];
};
