import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, cleanupTestDb } from "./setup";
import * as taskService from "../src/core/task";
import * as projectService from "../src/core/project";
import { closeDb } from "../src/db/client";

describe("Bulk Create", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create multiple tasks atomically", () => {
    const tasks = taskService.createTasksBulk([
      { title: "Bulk 1" },
      { title: "Bulk 2" },
      { title: "Bulk 3" },
    ]);

    expect(tasks.length).toBe(3);
    expect(tasks[0].title).toBe("Bulk 1");
    expect(tasks[1].title).toBe("Bulk 2");
    expect(tasks[2].title).toBe("Bulk 3");
  });

  test("bulk create with all fields", () => {
    const tasks = taskService.createTasksBulk([
      { title: "Full bulk", priority: "p0", tags: ["urgent"] },
      { title: "Another bulk", priority: "p1", description: "desc" },
    ]);

    expect(tasks[0].priority).toBe("p0");
    expect(tasks[0].tags).toEqual(["urgent"]);
    expect(tasks[1].description).toBe("desc");
  });

  test("empty bulk create returns empty array", () => {
    const tasks = taskService.createTasksBulk([]);
    expect(tasks).toEqual([]);
  });
});

describe("Bulk Update", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("update multiple tasks with same updates", () => {
    const task1 = taskService.createTask({ title: "Update bulk 1" });
    const task2 = taskService.createTask({ title: "Update bulk 2" });

    const updated = taskService.updateTasksBulk(
      [task1.id, task2.id],
      { priority: "p0" }
    );

    expect(updated.length).toBe(2);
    expect(updated.every(t => t.priority === "p0")).toBe(true);
  });

  test("bulk update changes version", () => {
    const task = taskService.createTask({ title: "Version bulk" });

    const updated = taskService.updateTasksBulk(
      [task.id],
      { title: "Updated version" }
    );

    expect(updated[0].version).toBe(2);
  });

  test("empty bulk update returns empty array", () => {
    const tasks = taskService.updateTasksBulk([], {});
    expect(tasks).toEqual([]);
  });
});

describe("Bulk Transition", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("transition multiple tasks to same status", () => {
    const task1 = taskService.createTask({ title: "Trans bulk 1" });
    const task2 = taskService.createTask({ title: "Trans bulk 2" });

    const results = taskService.transitionTasksBulk(
      [task1.id, task2.id],
      "in_progress"
    );

    expect(results.updated.length).toBe(2);
    expect(results.updated.every(t => t.status === "in_progress")).toBe(true);
    expect(results.failed.length).toBe(0);
  });

  test("bulk transition with invalid transition fails by default", () => {
    const task = taskService.createTask({ title: "Invalid trans" });

    expect(() => {
      taskService.transitionTasksBulk([task.id], "completed"); // Invalid: pending -> completed
    }).toThrow("Cannot transition");
  });

  test("bulk transition with skip_invalid skips failures", () => {
    const task1 = taskService.createTask({ title: "Skip trans 1" });
    const task2 = taskService.createTask({ title: "Skip trans 2" });

    // Transition task1 to in_progress first
    taskService.transitionTask(task1.id, "in_progress");

    // Now try to transition both to completed
    // task1 (in_progress -> completed) should succeed
    // task2 (pending -> completed) should fail but be skipped
    const results = taskService.transitionTasksBulk(
      [task1.id, task2.id],
      "completed",
      true // skip_invalid
    );

    expect(results.updated.length).toBe(1);
    expect(results.failed.length).toBe(1);
    expect(results.failed[0].id).toBe(task2.id);
  });

  test("empty bulk transition returns empty result", () => {
    const results = taskService.transitionTasksBulk([], "in_progress");
    expect(results.updated).toEqual([]);
    expect(results.failed).toEqual([]);
  });
});
