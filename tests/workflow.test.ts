import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { closeDb } from "../src/db/client.js";
import * as taskService from "../src/core/task.js";
import * as workflow from "../src/core/workflow.js";
import * as projectService from "../src/core/project.js";
import { setupTestDb, cleanupTestDb } from "./setup.js";

describe("Workflow Transitions", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  describe("canTransition", () => {
    test("pending can transition to in_progress", () => {
      const result = workflow.canTransition("pending", "in_progress");
      expect(result.valid).toBe(true);
    });

    test("pending can transition to blocked", () => {
      const result = workflow.canTransition("pending", "blocked");
      expect(result.valid).toBe(true);
    });

    test("pending cannot transition directly to completed", () => {
      const result = workflow.canTransition("pending", "completed");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Cannot transition");
    });

    test("in_progress can transition to verification", () => {
      const result = workflow.canTransition("in_progress", "verification");
      expect(result.valid).toBe(true);
    });

    test("in_progress can skip verification and go to completed", () => {
      const result = workflow.canTransition("in_progress", "completed");
      expect(result.valid).toBe(true);
    });

    test("verification can transition to completed", () => {
      const result = workflow.canTransition("verification", "completed");
      expect(result.valid).toBe(true);
    });

    test("verification can go back to in_progress", () => {
      const result = workflow.canTransition("verification", "in_progress");
      expect(result.valid).toBe(true);
    });

    test("completed can be reopened to in_progress", () => {
      const result = workflow.canTransition("completed", "in_progress");
      expect(result.valid).toBe(true);
    });

    test("archived is terminal - no transitions allowed", () => {
      const result = workflow.canTransition("archived", "pending");
      expect(result.valid).toBe(false);
    });

    test("same status transition is invalid", () => {
      const result = workflow.canTransition("pending", "pending");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("already in");
    });
  });

  describe("getAllowedTransitions", () => {
    test("returns correct transitions for pending", () => {
      const allowed = workflow.getAllowedTransitions("pending");
      expect(allowed).toContain("in_progress");
      expect(allowed).toContain("blocked");
      expect(allowed).toContain("archived");
      expect(allowed).not.toContain("completed");
    });

    test("returns empty array for archived", () => {
      const allowed = workflow.getAllowedTransitions("archived");
      expect(allowed).toHaveLength(0);
    });
  });

  describe("Task Workflow Integration", () => {
    test("full workflow: pending -> in_progress -> completed", () => {
      const task = taskService.createTask({ title: "Workflow test" });
      expect(task.status).toBe("pending");

      const inProgress = taskService.transitionTask(task.id, "in_progress");
      expect(inProgress.task.status).toBe("in_progress");

      const completed = taskService.transitionTask(task.id, "completed");
      expect(completed.task.status).toBe("completed");
    });

    test("workflow with verification: pending -> in_progress -> verification -> completed", () => {
      const task = taskService.createTask({ title: "Verification workflow" });

      taskService.transitionTask(task.id, "in_progress");
      taskService.transitionTask(task.id, "verification");
      const completed = taskService.transitionTask(task.id, "completed");

      expect(completed.task.status).toBe("completed");
    });

    test("blocked workflow: pending -> blocked -> in_progress -> completed", () => {
      const task = taskService.createTask({ title: "Blocked workflow" });

      taskService.transitionTask(task.id, "blocked");
      taskService.transitionTask(task.id, "in_progress");
      const completed = taskService.transitionTask(task.id, "completed");

      expect(completed.task.status).toBe("completed");
    });

    test("invalid transition throws error", () => {
      const task = taskService.createTask({ title: "Invalid transition" });

      expect(() => {
        taskService.transitionTask(task.id, "completed");
      }).toThrow();
    });

    test("archived task cannot be transitioned", () => {
      const task = taskService.createTask({ title: "Archive test" });
      taskService.transitionTask(task.id, "archived");

      expect(() => {
        taskService.transitionTask(task.id, "pending");
      }).toThrow();
    });
  });
});
