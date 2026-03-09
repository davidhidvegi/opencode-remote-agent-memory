import type { User, UserPermissions, PermissionLevel, MemoryScope } from "./types.js";

export function hasPermission(
  user: User,
  scope: MemoryScope,
  permission: "read" | "write",
  identifier?: string
): boolean {
  const perms = user.permissions;
  
  switch (scope) {
    case "global": {
      const level = perms.global;
      if (permission === "write") return level === "write";
      return level === "read" || level === "write";
    }
    
    case "user": {
      const level = resolveUserPermission(perms.users, identifier, user.id);
      if (permission === "write") return level === "write";
      return level === "read" || level === "write";
    }
    
    case "project": {
      const level = resolveProjectPermission(perms.projects, identifier);
      if (permission === "write") return level === "write";
      return level === "read" || level === "write";
    }
    
    case "domain": {
      const level = perms.domain;
      if (permission === "write") return level === "write";
      return level === "read" || level === "write";
    }
    
    default:
      return false;
  }
}

function resolveUserPermission(
  userPermissions: UserPermissions["users"],
  targetUserId: string | undefined,
  currentUserId: string
): PermissionLevel {
  if (!targetUserId) return "none";
  
  for (const entry of userPermissions) {
    const key = Object.keys(entry)[0];
    const level = entry[key];
    
    if (key === "SELF" && targetUserId === currentUserId) {
      return level;
    }
    
    if (key === "ALL") {
      return level;
    }
    
    if (key === targetUserId) {
      return level;
    }
  }
  
  return "none";
}

function resolveProjectPermission(
  projectPermissions: UserPermissions["projects"],
  projectName: string | undefined
): PermissionLevel {
  if (!projectName) return "none";
  
  for (const entry of projectPermissions) {
    const key = Object.keys(entry)[0];
    const level = entry[key];
    
    if (key === "ALL") {
      return level;
    }
    
    if (key === projectName) {
      return level;
    }
  }
  
  return "none";
}

export function getAccessibleProjects(user: User): string[] {
  const projects: string[] = [];
  
  for (const entry of user.permissions.projects) {
    const key = Object.keys(entry)[0];
    const level = entry[key];
    
    if (level === "read" || level === "write") {
      if (key === "ALL") {
        return ["ALL"];
      }
      projects.push(key);
    }
  }
  
  return projects;
}

export function getAccessibleUsers(user: User, includeSelf: boolean = true): string[] {
  const users: string[] = [];
  let hasAllPermission = false;
  
  if (includeSelf) {
    users.push(user.id);
  }
  
  for (const entry of user.permissions.users) {
    const key = Object.keys(entry)[0];
    const level = entry[key];
    
    if (level === "read" || level === "write") {
      if (key === "ALL") {
        hasAllPermission = true;
      } else if (key !== "SELF") {
        users.push(key);
      }
    }
  }
  
  if (hasAllPermission) {
    if (!users.includes("ALL")) {
      users.push("ALL");
    }
  }
  
  return users;
}
