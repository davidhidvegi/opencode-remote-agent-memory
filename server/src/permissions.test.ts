import { describe, expect, test } from "bun:test";
import type { User } from "./types.js";
import { getAccessibleUsers, getAccessibleProjects, hasPermission } from "./permissions.js";

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "david",
  name: "David",
  apiKey: "hash",
  permissions: {
    global: "write",
    users: [],
    projects: [],
    domain: "write",
  },
  ...overrides,
});

describe("getAccessibleUsers", () => {
  test("includes current user by default", () => {
    const user = createMockUser({ id: "david" });
    const result = getAccessibleUsers(user);
    expect(result).toContain("david");
  });

  test("does not include self when includeSelf is false", () => {
    const user = createMockUser({ id: "david" });
    const result = getAccessibleUsers(user, false);
    expect(result).not.toContain("david");
  });

  test("includes other users when explicitly listed with read permission", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "write",
        users: [{ alice: "read" }],
        projects: [],
        domain: "write",
      },
    });
    const result = getAccessibleUsers(user);
    expect(result).toContain("david");
    expect(result).toContain("alice");
  });

  test("with ALL permission returns ALL but still includes own user ID for reading", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "write",
        users: [{ ALL: "write" }],
        projects: [],
        domain: "write",
      },
    });
    const result = getAccessibleUsers(user);
    // The fix: should return both "ALL" AND the user's own ID
    // Previously this returned only ["ALL"] which broke user block reading
    expect(result).toContain("ALL");
    expect(result).toContain("david");
  });

  test("ALL permission without SELF includes user's own ID", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "write",
        users: [{ ALL: "read" }],
        projects: [],
        domain: "write",
      },
    });
    const result = getAccessibleUsers(user, true);
    expect(result).toContain("david");
    expect(result).toContain("ALL");
  });
});

describe("hasPermission", () => {
  test("user can read/write their own blocks with SELF permission", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "write",
        users: [{ SELF: "write" }],
        projects: [],
        domain: "write",
      },
    });
    expect(hasPermission(user, "user", "read", "david")).toBe(true);
    expect(hasPermission(user, "user", "write", "david")).toBe(true);
  });

  test("user cannot access other users without explicit permission", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "write",
        users: [{ SELF: "write" }],
        projects: [],
        domain: "write",
      },
    });
    expect(hasPermission(user, "user", "read", "alice")).toBe(false);
  });

  test("user with ALL permission can access any user", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "write",
        users: [{ ALL: "write" }],
        projects: [],
        domain: "write",
      },
    });
    expect(hasPermission(user, "user", "read", "alice")).toBe(true);
    expect(hasPermission(user, "user", "write", "bob")).toBe(true);
  });
});

describe("getAccessibleProjects", () => {
  test("returns list of project names user has access to", () => {
    const user = createMockUser({
      permissions: {
        global: "write",
        users: [],
        projects: [{ foo: "read" }, { bar: "write" }],
        domain: "write",
      },
    });
    const result = getAccessibleProjects(user);
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  test("with ALL permission returns list that can be used to enumerate all projects", () => {
    const user = createMockUser({
      permissions: {
        global: "write",
        users: [],
        projects: [{ ALL: "read" }],
        domain: "write",
      },
    });
    const result = getAccessibleProjects(user);
    expect(result).toContain("ALL");
  });
});

describe("project permission for specific project name", () => {
  test("user with specific project permission can read that project", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "none",
        users: [],
        projects: [{ myproject: "read" }],
        domain: "none",
      },
    });
    expect(hasPermission(user, "project", "read", "myproject")).toBe(true);
    expect(hasPermission(user, "project", "write", "myproject")).toBe(false);
  });

  test("user with write permission can read and write project", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "none",
        users: [],
        projects: [{ myproject: "write" }],
        domain: "none",
      },
    });
    expect(hasPermission(user, "project", "read", "myproject")).toBe(true);
    expect(hasPermission(user, "project", "write", "myproject")).toBe(true);
  });

  test("user without project permission cannot access project", () => {
    const user = createMockUser({
      id: "david",
      permissions: {
        global: "none",
        users: [],
        projects: [{ otherproject: "read" }],
        domain: "none",
      },
    });
    expect(hasPermission(user, "project", "read", "myproject")).toBe(false);
  });
});
