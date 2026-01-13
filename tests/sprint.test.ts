import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, cleanupTestDb } from "./setup";
import * as sprintService from "../src/core/sprint";
import * as taskService from "../src/core/task";
import * as projectService from "../src/core/project";
import { closeDb } from "../src/db/client";

describe("Sprint CRUD", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create sprint", () => {
    const sprint = sprintService.createSprint({ name: "Sprint 1" });

    expect(sprint).toBeDefined();
    expect(sprint.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sprint.name).toBe("Sprint 1");
    expect(sprint.status).toBe("planning");
  });

  test("create sprint with dates", () => {
    const start = "2026-01-15T00:00:00.000Z";
    const end = "2026-01-29T00:00:00.000Z";

    const sprint = sprintService.createSprint({
      name: "Sprint 2",
      start_at: start,
      end_at: end,
    });

    expect(sprint.start_at).toBe(start);
    expect(sprint.end_at).toBe(end);
  });

  test("get sprint", () => {
    const created = sprintService.createSprint({ name: "Get sprint" });
    const fetched = sprintService.getSprint(created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Get sprint");
  });

  test("get non-existent sprint throws NotFoundError", () => {
    expect(() => {
      sprintService.getSprint("00000000-0000-0000-0000-000000000000");
    }).toThrow("Sprint not found");
  });

  test("update sprint", () => {
    const sprint = sprintService.createSprint({ name: "Update sprint" });

    const updated = sprintService.updateSprint(sprint.id, {
      name: "Updated name",
      status: "active",
    });

    expect(updated.name).toBe("Updated name");
    expect(updated.status).toBe("active");
  });

  test("delete sprint", () => {
    const sprint = sprintService.createSprint({ name: "Delete sprint" });

    sprintService.deleteSprint(sprint.id);

    expect(() => {
      sprintService.getSprint(sprint.id);
    }).toThrow("Sprint not found");
  });

  test("list sprints", () => {
    sprintService.createSprint({ name: "List sprint 1" });
    sprintService.createSprint({ name: "List sprint 2" });

    const sprints = sprintService.listSprints();
    expect(sprints.length).toBeGreaterThanOrEqual(2);
  });

  test("list sprints excludes archived by default", () => {
    const sprint = sprintService.createSprint({ name: "Archive sprint" });
    sprintService.updateSprint(sprint.id, { status: "archived" });

    const sprints = sprintService.listSprints(false);
    expect(sprints.find(s => s.id === sprint.id)).toBeUndefined();

    const withArchived = sprintService.listSprints(true);
    expect(withArchived.find(s => s.id === sprint.id)).toBeDefined();
  });
});

describe("Sprint Activation", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("activate sprint", () => {
    const sprint = sprintService.createSprint({ name: "Activate sprint" });

    const activated = sprintService.activateSprint(sprint.id);
    expect(activated.status).toBe("active");

    const active = sprintService.getActiveSprint();
    expect(active?.id).toBe(sprint.id);
  });

  test("only one sprint can be active", () => {
    const sprint1 = sprintService.createSprint({ name: "Active 1" });
    const sprint2 = sprintService.createSprint({ name: "Active 2" });

    sprintService.activateSprint(sprint1.id);
    expect(sprintService.getActiveSprint()?.id).toBe(sprint1.id);

    sprintService.activateSprint(sprint2.id);
    expect(sprintService.getActiveSprint()?.id).toBe(sprint2.id);

    // sprint1 should no longer be active
    const s1 = sprintService.getSprint(sprint1.id);
    expect(s1.status).not.toBe("active");
  });
});

describe("Sprint with Tasks", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("assign task to sprint", () => {
    const sprint = sprintService.createSprint({ name: "Task sprint" });
    const task = taskService.createTask({ title: "Sprint task", sprint_id: sprint.id });

    expect(task.sprint_id).toBe(sprint.id);
  });

  test("get sprint with tasks", () => {
    const sprint = sprintService.createSprint({ name: "With tasks" });
    taskService.createTask({ title: "Task 1", sprint_id: sprint.id });
    taskService.createTask({ title: "Task 2", sprint_id: sprint.id });
    taskService.createTask({ title: "Task 3", sprint_id: sprint.id, status: "in_progress" });

    const sprintWithTasks = sprintService.getSprintWithTasks(sprint.id);

    expect(sprintWithTasks.tasks.length).toBe(3);
    expect(sprintWithTasks.counts.total).toBe(3);
    expect(sprintWithTasks.counts.pending).toBe(2);
    expect(sprintWithTasks.counts.in_progress).toBe(1);
  });

  test("deleting sprint unassigns tasks", () => {
    const sprint = sprintService.createSprint({ name: "Delete tasks sprint" });
    const task = taskService.createTask({ title: "Orphan task", sprint_id: sprint.id });

    sprintService.deleteSprint(sprint.id);

    const fetchedTask = taskService.getTask(task.id);
    expect(fetchedTask.sprint_id).toBeUndefined();
  });

  test("list tasks by sprint", () => {
    const sprint = sprintService.createSprint({ name: "Filter sprint" });
    taskService.createTask({ title: "Sprint filter 1", sprint_id: sprint.id });
    taskService.createTask({ title: "Sprint filter 2", sprint_id: sprint.id });
    taskService.createTask({ title: "No sprint" });

    const sprintTasks = taskService.listTasks({ sprint_id: sprint.id });
    expect(sprintTasks.length).toBe(2);
    expect(sprintTasks.every(t => t.sprint_id === sprint.id)).toBe(true);
  });
});
