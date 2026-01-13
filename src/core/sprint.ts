import { randomUUID } from "crypto";
import * as sprintRepo from "../db/repositories/sprint.repo.js";
import * as taskRepo from "../db/repositories/task.repo.js";
import {
  CreateSprintInput,
  UpdateSprintInput,
  type Sprint,
} from "../schemas/sprint.js";
import { NotFoundError } from "../utils/errors.js";
import type { Task } from "../schemas/task.js";
import { getCurrentProjectId } from "./project.js";

export function createSprint(input: CreateSprintInput): Sprint {
  const validatedInput = CreateSprintInput.parse(input);

  // Auto-assign current project if none specified
  const sprintInput = {
    ...validatedInput,
    project_id: validatedInput.project_id ?? getCurrentProjectId() ?? undefined,
  };

  const id = randomUUID();
  return sprintRepo.createSprint(id, sprintInput);
}

export function getSprint(id: string): Sprint {
  const sprint = sprintRepo.getSprintById(id);
  if (!sprint) {
    throw new NotFoundError("Sprint", id);
  }
  return sprint;
}

export function updateSprint(id: string, input: UpdateSprintInput): Sprint {
  const validatedInput = UpdateSprintInput.parse(input);

  const existing = sprintRepo.getSprintById(id);
  if (!existing) {
    throw new NotFoundError("Sprint", id);
  }

  const updated = sprintRepo.updateSprint(id, validatedInput);
  if (!updated) {
    throw new NotFoundError("Sprint", id);
  }

  return updated;
}

export function deleteSprint(id: string): void {
  const existing = sprintRepo.getSprintById(id);
  if (!existing) {
    throw new NotFoundError("Sprint", id);
  }

  sprintRepo.deleteSprint(id);
}

export function listSprints(includeArchived = false): Sprint[] {
  const sprints = sprintRepo.listSprints(includeArchived);

  // Filter by current project if one is selected
  const projectId = getCurrentProjectId();
  return projectId ? sprints.filter(s => s.project_id === projectId) : sprints;
}

export function getActiveSprint(): Sprint | null {
  return sprintRepo.getActiveSprint();
}

export function activateSprint(id: string): Sprint {
  const existing = sprintRepo.getSprintById(id);
  if (!existing) {
    throw new NotFoundError("Sprint", id);
  }

  const activated = sprintRepo.setActiveSprint(id);
  if (!activated) {
    throw new NotFoundError("Sprint", id);
  }

  return activated;
}

export interface SprintWithTasks extends Sprint {
  tasks: Task[];
  counts: Record<string, number>;
}

export function getSprintWithTasks(id: string): SprintWithTasks {
  const sprint = sprintRepo.getSprintById(id);
  if (!sprint) {
    throw new NotFoundError("Sprint", id);
  }

  const tasks = taskRepo.listTasks({ sprint_id: id, include_archived: true });
  const counts = sprintRepo.getSprintTaskCounts(id);

  return {
    ...sprint,
    tasks,
    counts,
  };
}

export interface SprintSummary extends Sprint {
  counts: Record<string, number>;
}

export function listSprintsWithCounts(includeArchived = false): SprintSummary[] {
  const sprints = listSprints(includeArchived);
  return sprints.map((sprint) => ({
    ...sprint,
    counts: sprintRepo.getSprintTaskCounts(sprint.id),
  }));
}
