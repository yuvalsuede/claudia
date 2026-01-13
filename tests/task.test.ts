import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, cleanupTestDb } from "./setup";
import * as taskService from "../src/core/task";
import * as projectService from "../src/core/project";
import { closeDb } from "../src/db/client";

describe("Task CRUD", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create task with minimal fields", () => {
    const task = taskService.createTask({ title: "Test task" });

    expect(task).toBeDefined();
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(task.title).toBe("Test task");
    expect(task.status).toBe("pending");
    expect(task.version).toBe(1);
  });

  test("create task with all fields", () => {
    const task = taskService.createTask({
      title: "Full task",
      description: "A detailed description",
      priority: "p1",
      tags: ["tag1", "tag2"],
      assignee: "user@example.com",
    });

    expect(task.title).toBe("Full task");
    expect(task.description).toBe("A detailed description");
    expect(task.priority).toBe("p1");
    expect(task.tags).toEqual(["tag1", "tag2"]);
    expect(task.assignee).toBe("user@example.com");
  });

  test("get task by id", () => {
    const created = taskService.createTask({ title: "Get me" });
    const fetched = taskService.getTask(created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe("Get me");
  });

  test("get non-existent task throws NotFoundError", () => {
    expect(() => {
      taskService.getTask("00000000-0000-0000-0000-000000000000");
    }).toThrow("Task not found");
  });

  test("update task fields", () => {
    const task = taskService.createTask({ title: "Update me" });

    const updated = taskService.updateTask(task.id, {
      title: "Updated title",
      priority: "p0",
      description: "New description",
    });

    expect(updated.title).toBe("Updated title");
    expect(updated.priority).toBe("p0");
    expect(updated.description).toBe("New description");
    expect(updated.version).toBe(2);
  });

  test("update with optimistic locking", () => {
    const task = taskService.createTask({ title: "Lock test" });

    // Update with correct version
    const updated = taskService.updateTask(task.id, {
      title: "Version 2",
      version: 1,
    });
    expect(updated.version).toBe(2);

    // Update with wrong version should fail
    expect(() => {
      taskService.updateTask(task.id, {
        title: "Should fail",
        version: 1, // Wrong version
      });
    }).toThrow("Version mismatch");
  });

  test("delete task", () => {
    const task = taskService.createTask({ title: "Delete me" });

    taskService.deleteTask(task.id);

    expect(() => {
      taskService.getTask(task.id);
    }).toThrow("Task not found");
  });

  test("list tasks", () => {
    // Create some tasks
    taskService.createTask({ title: "List test 1", priority: "p0" });
    taskService.createTask({ title: "List test 2", priority: "p1" });
    taskService.createTask({ title: "List test 3", priority: "p0" });

    const allTasks = taskService.listTasks({});
    expect(allTasks.length).toBeGreaterThanOrEqual(3);

    const p0Tasks = taskService.listTasks({ priority: ["p0"] });
    expect(p0Tasks.every(t => t.priority === "p0")).toBe(true);
  });

  test("list tasks with pagination", () => {
    const tasks = taskService.listTasks({ limit: 2, offset: 0 });
    expect(tasks.length).toBeLessThanOrEqual(2);
  });

  test("list excludes archived by default", () => {
    const task = taskService.createTask({ title: "Will archive" });
    taskService.updateTask(task.id, { status: "archived" });

    const tasks = taskService.listTasks({});
    expect(tasks.find(t => t.id === task.id)).toBeUndefined();

    const withArchived = taskService.listTasks({ include_archived: true });
    expect(withArchived.find(t => t.id === task.id)).toBeDefined();
  });
});

describe("Task Hierarchy", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create child task", () => {
    const parent = taskService.createTask({ title: "Parent" });
    const child = taskService.createTask({ title: "Child", parent_id: parent.id });

    expect(child.parent_id).toBe(parent.id);
  });

  test("prevent circular parent reference", () => {
    const task = taskService.createTask({ title: "Self ref" });

    expect(() => {
      taskService.updateTask(task.id, { parent_id: task.id });
    }).toThrow("cannot be its own parent");
  });

  test("prevent circular chain", () => {
    const a = taskService.createTask({ title: "A" });
    const b = taskService.createTask({ title: "B", parent_id: a.id });
    const c = taskService.createTask({ title: "C", parent_id: b.id });

    expect(() => {
      taskService.updateTask(a.id, { parent_id: c.id });
    }).toThrow("Circular");
  });

  test("get task tree", () => {
    const parent = taskService.createTask({ title: "Tree parent" });
    const child1 = taskService.createTask({ title: "Tree child 1", parent_id: parent.id });
    const child2 = taskService.createTask({ title: "Tree child 2", parent_id: parent.id });
    taskService.createTask({ title: "Grandchild", parent_id: child1.id });

    const tree = taskService.getTaskTree(parent.id);

    expect(tree.title).toBe("Tree parent");
    expect(tree.children.length).toBe(2);
    expect(tree.children.find(c => c.title === "Tree child 1")?.children.length).toBe(1);
  });

  test("get full tree", () => {
    const trees = taskService.getFullTree();
    expect(Array.isArray(trees)).toBe(true);
  });
});

describe("Task Context", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("set and get context", () => {
    const task = taskService.createTask({ title: "Context test" });

    taskService.setTaskContext(task.id, { key: "value", nested: { a: 1 } });
    const context = taskService.getTaskContext(task.id);

    expect(context).toEqual({ key: "value", nested: { a: 1 } });
  });

  test("merge context (deep merge)", () => {
    const task = taskService.createTask({ title: "Merge test" });

    taskService.setTaskContext(task.id, { a: 1, b: { x: 1, y: 2 } });
    taskService.mergeTaskContext(task.id, { b: { y: 3, z: 4 }, c: 5 });

    const context = taskService.getTaskContext(task.id);
    expect(context).toEqual({ a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 });
  });

  test("context size limit", () => {
    const task = taskService.createTask({ title: "Size limit test" });
    const largeContext = { data: "x".repeat(70000) }; // > 64KB

    expect(() => {
      taskService.setTaskContext(task.id, largeContext);
    }).toThrow("64KB");
  });
});

describe("State Transitions", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("valid transition: pending -> in_progress", () => {
    const task = taskService.createTask({ title: "Transition test" });
    const result = taskService.transitionTask(task.id, "in_progress");

    expect(result.task.status).toBe("in_progress");
    expect(result.transition.from).toBe("pending");
    expect(result.transition.to).toBe("in_progress");
  });

  test("valid transition: in_progress -> completed", () => {
    const task = taskService.createTask({ title: "Complete test" });
    taskService.transitionTask(task.id, "in_progress");
    const result = taskService.transitionTask(task.id, "completed");

    expect(result.task.status).toBe("completed");
  });

  test("invalid transition: pending -> completed", () => {
    const task = taskService.createTask({ title: "Invalid test" });

    expect(() => {
      taskService.transitionTask(task.id, "completed");
    }).toThrow("Cannot transition");
  });

  test("archived is terminal state", () => {
    const task = taskService.createTask({ title: "Archive test" });
    taskService.transitionTask(task.id, "archived");

    expect(() => {
      taskService.transitionTask(task.id, "pending");
    }).toThrow("Cannot transition");
  });

  test("get available transitions", () => {
    const task = taskService.createTask({ title: "Available test" });
    const { current, allowed } = taskService.getAvailableTransitions(task.id);

    expect(current).toBe("pending");
    expect(allowed).toContain("in_progress");
    expect(allowed).toContain("blocked");
    expect(allowed).not.toContain("completed");
  });
});

describe("Task Claiming", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("claim unclaimed task", () => {
    const task = taskService.createTask({ title: "Claim test" });
    const result = taskService.claimTask(task.id, "agent-1");

    expect(result.success).toBe(true);
    expect(result.task.agent_id).toBe("agent-1");
    expect(result.message).toBe("Task claimed successfully");
  });

  test("cannot claim already claimed task", () => {
    const task = taskService.createTask({ title: "Already claimed" });
    taskService.claimTask(task.id, "agent-1");

    const result = taskService.claimTask(task.id, "agent-2");

    expect(result.success).toBe(false);
    expect(result.message).toContain("already claimed by agent: agent-1");
  });

  test("claiming own task returns message", () => {
    const task = taskService.createTask({ title: "Own claim" });
    taskService.claimTask(task.id, "agent-1");

    const result = taskService.claimTask(task.id, "agent-1");

    expect(result.success).toBe(false);
    expect(result.message).toBe("Task already claimed by you");
  });

  test("release claimed task", () => {
    const task = taskService.createTask({ title: "Release test" });
    taskService.claimTask(task.id, "agent-1");

    const result = taskService.releaseTask(task.id, "agent-1");

    expect(result.success).toBe(true);
    expect(result.task.agent_id).toBeUndefined();
    expect(result.message).toBe("Task released successfully");
  });

  test("cannot release unclaimed task", () => {
    const task = taskService.createTask({ title: "Not claimed" });

    const result = taskService.releaseTask(task.id, "agent-1");

    expect(result.success).toBe(false);
    expect(result.message).toBe("Task is not claimed");
  });

  test("cannot release task claimed by another agent", () => {
    const task = taskService.createTask({ title: "Other agent claim" });
    taskService.claimTask(task.id, "agent-1");

    const result = taskService.releaseTask(task.id, "agent-2");

    expect(result.success).toBe(false);
    expect(result.message).toContain("claimed by different agent: agent-1");
  });

  test("claim non-existent task throws NotFoundError", () => {
    expect(() => {
      taskService.claimTask("00000000-0000-0000-0000-000000000000", "agent-1");
    }).toThrow("Task not found");
  });

  test("release non-existent task throws NotFoundError", () => {
    expect(() => {
      taskService.releaseTask("00000000-0000-0000-0000-000000000000", "agent-1");
    }).toThrow("Task not found");
  });
});
