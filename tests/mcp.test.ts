import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, cleanupTestDb } from "./setup";
import { closeDb } from "../src/db/client";
import { TOOL_DEFINITIONS } from "../src/mcp/tools";
import { handleToolCall } from "../src/mcp/server";

describe("MCP Tool Definitions", () => {
  test("all tools have required fields", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  test("tool names follow convention", () => {
    const expectedTools = [
      "task_create", "task_read", "task_update", "task_delete", "task_list",
      "task_transition", "task_context_set", "task_context_get", "task_context_merge",
      "task_tree", "task_create_many", "task_update_many", "task_transition_many",
      "task_dependency_add", "task_dependency_remove", "task_dependencies",
      "task_blocked", "task_ready",
      "sprint_create", "sprint_list", "sprint_show", "sprint_update",
      "sprint_delete", "sprint_activate",
    ];

    const toolNames = TOOL_DEFINITIONS.map(t => t.name);
    for (const expected of expectedTools) {
      expect(toolNames).toContain(expected);
    }
  });
});

describe("MCP Task Tools", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("task_create creates task", async () => {
    const result = await handleToolCall("task_create", { title: "MCP Task" });
    expect(result.content[0].type).toBe("text");

    const data = JSON.parse(result.content[0].text);
    expect(data.title).toBe("MCP Task");
    expect(data.id).toBeDefined();
  });

  test("task_read retrieves task", async () => {
    const createResult = await handleToolCall("task_create", { title: "Read MCP" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("task_read", { id: created.id });
    const data = JSON.parse(result.content[0].text);

    expect(data.id).toBe(created.id);
    expect(data.title).toBe("Read MCP");
  });

  test("task_update modifies task", async () => {
    const createResult = await handleToolCall("task_create", { title: "Update MCP" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("task_update", {
      id: created.id,
      title: "Updated MCP",
      priority: "p0",
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.title).toBe("Updated MCP");
    expect(data.priority).toBe("p0");
  });

  test("task_delete removes task", async () => {
    const createResult = await handleToolCall("task_create", { title: "Delete MCP" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("task_delete", { id: created.id });
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);

    // Verify deletion
    const readResult = await handleToolCall("task_read", { id: created.id });
    expect(readResult.isError).toBe(true);
  });

  test("task_list returns tasks", async () => {
    await handleToolCall("task_create", { title: "List MCP 1" });
    await handleToolCall("task_create", { title: "List MCP 2" });

    const result = await handleToolCall("task_list", {});
    const data = JSON.parse(result.content[0].text);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  test("task_transition changes status", async () => {
    const createResult = await handleToolCall("task_create", { title: "Transition MCP" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("task_transition", {
      id: created.id,
      to: "in_progress",
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.task.status).toBe("in_progress");
    expect(data.transition.from).toBe("pending");
    expect(data.transition.to).toBe("in_progress");
  });
});

describe("MCP Context Tools", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("task_context_set and task_context_get", async () => {
    const createResult = await handleToolCall("task_create", { title: "Context MCP" });
    const created = JSON.parse(createResult.content[0].text);

    await handleToolCall("task_context_set", {
      id: created.id,
      context: { key: "value" },
    });

    const result = await handleToolCall("task_context_get", { id: created.id });
    const data = JSON.parse(result.content[0].text);

    expect(data).toEqual({ key: "value" });
  });

  test("task_context_merge deep merges", async () => {
    const createResult = await handleToolCall("task_create", { title: "Merge MCP" });
    const created = JSON.parse(createResult.content[0].text);

    await handleToolCall("task_context_set", {
      id: created.id,
      context: { a: 1, b: { x: 1 } },
    });

    await handleToolCall("task_context_merge", {
      id: created.id,
      context: { b: { y: 2 }, c: 3 },
    });

    const result = await handleToolCall("task_context_get", { id: created.id });
    const data = JSON.parse(result.content[0].text);

    expect(data).toEqual({ a: 1, b: { x: 1, y: 2 }, c: 3 });
  });
});

describe("MCP Bulk Tools", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("task_create_many creates multiple tasks", async () => {
    const result = await handleToolCall("task_create_many", {
      tasks: [
        { title: "Bulk MCP 1" },
        { title: "Bulk MCP 2" },
      ],
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.length).toBe(2);
    expect(data[0].title).toBe("Bulk MCP 1");
    expect(data[1].title).toBe("Bulk MCP 2");
  });

  test("task_update_many updates multiple tasks", async () => {
    const create1 = await handleToolCall("task_create", { title: "Update bulk 1" });
    const create2 = await handleToolCall("task_create", { title: "Update bulk 2" });
    const task1 = JSON.parse(create1.content[0].text);
    const task2 = JSON.parse(create2.content[0].text);

    const result = await handleToolCall("task_update_many", {
      ids: [task1.id, task2.id],
      updates: { priority: "p0" },
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.length).toBe(2);
    expect(data.every((t: any) => t.priority === "p0")).toBe(true);
  });

  test("task_transition_many transitions multiple tasks", async () => {
    const create1 = await handleToolCall("task_create", { title: "Trans bulk 1" });
    const create2 = await handleToolCall("task_create", { title: "Trans bulk 2" });
    const task1 = JSON.parse(create1.content[0].text);
    const task2 = JSON.parse(create2.content[0].text);

    const result = await handleToolCall("task_transition_many", {
      ids: [task1.id, task2.id],
      to: "in_progress",
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.updated.length).toBe(2);
  });
});

describe("MCP Dependency Tools", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("task_dependency_add and task_dependencies", async () => {
    const create1 = await handleToolCall("task_create", { title: "Dep A" });
    const create2 = await handleToolCall("task_create", { title: "Dep B" });
    const task1 = JSON.parse(create1.content[0].text);
    const task2 = JSON.parse(create2.content[0].text);

    await handleToolCall("task_dependency_add", {
      task_id: task1.id,
      depends_on_id: task2.id,
    });

    const result = await handleToolCall("task_dependencies", { task_id: task1.id });
    const data = JSON.parse(result.content[0].text);

    expect(data.depends_on).toContain(task2.id);
  });

  test("task_blocked returns blocked tasks", async () => {
    const blocker = await handleToolCall("task_create", { title: "MCP Blocker" });
    const blocked = await handleToolCall("task_create", { title: "MCP Blocked" });
    const blockerTask = JSON.parse(blocker.content[0].text);
    const blockedTask = JSON.parse(blocked.content[0].text);

    await handleToolCall("task_dependency_add", {
      task_id: blockedTask.id,
      depends_on_id: blockerTask.id,
    });

    const result = await handleToolCall("task_blocked", {});
    const data = JSON.parse(result.content[0].text);

    expect(data.find((t: any) => t.id === blockedTask.id)).toBeDefined();
  });
});

describe("MCP Sprint Tools", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("sprint_create creates sprint", async () => {
    const result = await handleToolCall("sprint_create", { name: "MCP Sprint" });
    const data = JSON.parse(result.content[0].text);

    expect(data.name).toBe("MCP Sprint");
    expect(data.status).toBe("planning");
  });

  test("sprint_list returns sprints", async () => {
    await handleToolCall("sprint_create", { name: "List Sprint 1" });
    await handleToolCall("sprint_create", { name: "List Sprint 2" });

    const result = await handleToolCall("sprint_list", {});
    const data = JSON.parse(result.content[0].text);

    expect(Array.isArray(data)).toBe(true);
  });

  test("sprint_activate activates sprint", async () => {
    const createResult = await handleToolCall("sprint_create", { name: "Activate Sprint" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("sprint_activate", { id: created.id });
    const data = JSON.parse(result.content[0].text);

    expect(data.status).toBe("active");
  });
});

describe("MCP Error Handling", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("returns error for unknown tool", async () => {
    const result = await handleToolCall("unknown_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });

  test("returns error for not found", async () => {
    const result = await handleToolCall("task_read", { id: "00000000-0000-0000-0000-000000000000" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});
