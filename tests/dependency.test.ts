import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, cleanupTestDb } from "./setup";
import * as taskService from "../src/core/task";
import { closeDb } from "../src/db/client";

describe("Task Dependencies", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("add dependency", () => {
    const taskA = taskService.createTask({ title: "Task A" });
    const taskB = taskService.createTask({ title: "Task B" });

    const result = taskService.addDependency(taskA.id, taskB.id);

    expect(result.task_id).toBe(taskA.id);
    expect(result.depends_on_id).toBe(taskB.id);
  });

  test("get task dependencies", () => {
    const taskA = taskService.createTask({ title: "Dep A" });
    const taskB = taskService.createTask({ title: "Dep B" });
    const taskC = taskService.createTask({ title: "Dep C" });

    taskService.addDependency(taskA.id, taskB.id);
    taskService.addDependency(taskA.id, taskC.id);

    const deps = taskService.getTaskDependencies(taskA.id);
    expect(deps).toContain(taskB.id);
    expect(deps).toContain(taskC.id);
  });

  test("get task dependents", () => {
    const taskA = taskService.createTask({ title: "Dependent A" });
    const taskB = taskService.createTask({ title: "Dependent B" });

    taskService.addDependency(taskA.id, taskB.id);

    const dependents = taskService.getTaskDependents(taskB.id);
    expect(dependents).toContain(taskA.id);
  });

  test("prevent self-dependency", () => {
    const task = taskService.createTask({ title: "Self dep" });

    expect(() => {
      taskService.addDependency(task.id, task.id);
    }).toThrow("cannot depend on itself");
  });

  test("prevent duplicate dependency", () => {
    const taskA = taskService.createTask({ title: "Dup A" });
    const taskB = taskService.createTask({ title: "Dup B" });

    taskService.addDependency(taskA.id, taskB.id);

    expect(() => {
      taskService.addDependency(taskA.id, taskB.id);
    }).toThrow("already exists");
  });

  test("prevent circular dependency", () => {
    const taskA = taskService.createTask({ title: "Circle A" });
    const taskB = taskService.createTask({ title: "Circle B" });
    const taskC = taskService.createTask({ title: "Circle C" });

    taskService.addDependency(taskA.id, taskB.id);
    taskService.addDependency(taskB.id, taskC.id);

    expect(() => {
      taskService.addDependency(taskC.id, taskA.id);
    }).toThrow("Circular");
  });

  test("remove dependency", () => {
    const taskA = taskService.createTask({ title: "Remove A" });
    const taskB = taskService.createTask({ title: "Remove B" });

    taskService.addDependency(taskA.id, taskB.id);
    const removed = taskService.removeDependency(taskA.id, taskB.id);

    expect(removed).toBe(true);

    const deps = taskService.getTaskDependencies(taskA.id);
    expect(deps).not.toContain(taskB.id);
  });

  test("get blocked tasks", () => {
    const blocker = taskService.createTask({ title: "Blocker" });
    const blocked = taskService.createTask({ title: "Blocked" });

    taskService.addDependency(blocked.id, blocker.id);

    const blockedTasks = taskService.getBlockedTasks();
    expect(blockedTasks.find(t => t.id === blocked.id)).toBeDefined();
  });

  test("get ready tasks", () => {
    const ready = taskService.createTask({ title: "Ready task" });
    const blocker = taskService.createTask({ title: "Blocker for ready" });
    const notReady = taskService.createTask({ title: "Not ready" });

    taskService.addDependency(notReady.id, blocker.id);

    const readyTasks = taskService.getReadyTasks();
    expect(readyTasks.find(t => t.id === ready.id)).toBeDefined();
  });

  test("completing blocker makes task ready", () => {
    const blocker = taskService.createTask({ title: "Will complete" });
    const waiting = taskService.createTask({ title: "Waiting" });

    taskService.addDependency(waiting.id, blocker.id);

    // Waiting should be blocked
    let blockedTasks = taskService.getBlockedTasks();
    expect(blockedTasks.find(t => t.id === waiting.id)).toBeDefined();

    // Complete the blocker
    taskService.transitionTask(blocker.id, "in_progress");
    taskService.transitionTask(blocker.id, "completed");

    // Now waiting should be ready (not blocked)
    blockedTasks = taskService.getBlockedTasks();
    expect(blockedTasks.find(t => t.id === waiting.id)).toBeUndefined();
  });
});
