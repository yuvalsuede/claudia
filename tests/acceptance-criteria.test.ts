import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { closeDb } from "../src/db/client.js";
import * as taskService from "../src/core/task.js";
import * as projectService from "../src/core/project.js";
import { setupTestDb, cleanupTestDb } from "./setup.js";

describe("Acceptance Criteria", () => {
  beforeAll(() => {
    setupTestDb();
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  describe("Creating tasks with acceptance criteria", () => {
    test("create task with acceptance criteria", () => {
      const task = taskService.createTask({
        title: "Task with AC",
        acceptance_criteria: [
          { description: "Has login form" },
          { description: "Validates email" },
          { description: "Shows error messages" },
        ],
      });

      expect(task.acceptance_criteria).toHaveLength(3);
      expect(task.acceptance_criteria![0].description).toBe("Has login form");
      expect(task.acceptance_criteria![0].verified).toBe(false);
    });

    test("acceptance criteria have unique IDs", () => {
      const task = taskService.createTask({
        title: "Unique IDs test",
        acceptance_criteria: [
          { description: "Criterion 1" },
          { description: "Criterion 2" },
        ],
      });

      const ids = task.acceptance_criteria!.map((c) => c.id);
      expect(new Set(ids).size).toBe(2); // All IDs should be unique
    });

    test("task without acceptance criteria has undefined or empty", () => {
      const task = taskService.createTask({ title: "No AC" });
      expect(task.acceptance_criteria === undefined || task.acceptance_criteria?.length === 0).toBe(true);
    });
  });

  describe("Verification", () => {
    test("verify single criterion", () => {
      const task = taskService.createTask({
        title: "Verify test",
        acceptance_criteria: [
          { description: "First criterion" },
          { description: "Second criterion" },
        ],
      });

      const criterionId = task.acceptance_criteria![0].id;
      const result = taskService.verifyTaskCriterion(task.id, criterionId, "agent-1", "Evidence");

      expect(result.all_verified).toBe(false);
      expect(result.verification_progress.verified).toBe(1);
      expect(result.verification_progress.total).toBe(2);
    });

    test("verify all criteria", () => {
      const task = taskService.createTask({
        title: "Verify all test",
        acceptance_criteria: [
          { description: "Criterion 1" },
          { description: "Criterion 2" },
        ],
      });

      const ids = task.acceptance_criteria!.map((c) => c.id);
      taskService.verifyTaskCriterion(task.id, ids[0], "agent-1");
      const result = taskService.verifyTaskCriterion(task.id, ids[1], "agent-1");

      expect(result.all_verified).toBe(true);
      expect(result.verification_progress.verified).toBe(2);
    });

    test("verification includes evidence", () => {
      const task = taskService.createTask({
        title: "Evidence test",
        acceptance_criteria: [{ description: "Test criterion" }],
      });

      const criterionId = task.acceptance_criteria![0].id;
      taskService.verifyTaskCriterion(task.id, criterionId, "agent-1", "Tested with unit tests");

      const updated = taskService.getTask(task.id);
      expect(updated.acceptance_criteria![0].evidence).toBe("Tested with unit tests");
      expect(updated.acceptance_criteria![0].verified_by).toBe("agent-1");
      expect(updated.acceptance_criteria![0].verified_at).toBeTruthy();
    });

    test("verifying non-existent criterion throws error", () => {
      const task = taskService.createTask({
        title: "Bad criterion test",
        acceptance_criteria: [{ description: "Real criterion" }],
      });

      expect(() => {
        taskService.verifyTaskCriterion(task.id, "fake-id", "agent-1");
      }).toThrow();
    });
  });

  describe("Verification Status", () => {
    test("get verification status for task", () => {
      const task = taskService.createTask({
        title: "Status test",
        acceptance_criteria: [
          { description: "One" },
          { description: "Two" },
          { description: "Three" },
        ],
      });

      const status = taskService.getVerificationStatus(task.id);

      expect(status.has_criteria).toBe(true);
      expect(status.progress.total).toBe(3);
      expect(status.progress.verified).toBe(0);
      expect(status.all_verified).toBe(false);
    });

    test("verification status updates after verification", () => {
      const task = taskService.createTask({
        title: "Update status test",
        acceptance_criteria: [
          { description: "One" },
          { description: "Two" },
        ],
      });

      const criterionId = task.acceptance_criteria![0].id;
      taskService.verifyTaskCriterion(task.id, criterionId, "agent-1");

      const status = taskService.getVerificationStatus(task.id);

      expect(status.progress.verified).toBe(1);
      expect(status.progress.total).toBe(2);
    });

    test("task without criteria shows all verified", () => {
      const task = taskService.createTask({ title: "No criteria" });
      const status = taskService.getVerificationStatus(task.id);

      expect(status.has_criteria).toBe(false);
      expect(status.all_verified).toBe(true);
      expect(status.progress.total).toBe(0);
    });
  });

  describe("Compound Operations with Acceptance Criteria", () => {
    test("startTask with acceptance criteria", () => {
      const task = taskService.startTask(
        {
          title: "Start with AC",
          acceptance_criteria: [
            { description: "AC 1" },
            { description: "AC 2" },
          ],
        },
        "agent-1"
      );

      expect(task.status).toBe("in_progress");
      expect(task.acceptance_criteria).toHaveLength(2);
    });

    test("finishTask completes task", () => {
      const task = taskService.startTask(
        { title: "Finish test" },
        "agent-1"
      );

      const finished = taskService.finishTask(task.id, "agent-1", "Done!");

      expect(finished.status).toBe("completed");
    });
  });
});
