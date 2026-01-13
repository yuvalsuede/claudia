import { randomUUID } from "crypto";
import * as taskRepo from "../db/repositories/task.repo.js";
import * as depRepo from "../db/repositories/dependency.repo.js";
import {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
  type Task,
} from "../schemas/task.js";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors.js";
import { canTransition, getAllowedTransitions } from "./workflow.js";
import type { TransitionResult } from "./workflow.js";

export function createTask(input: CreateTaskInput): Task {
  const validatedInput = CreateTaskInput.parse(input);

  // Validate parent exists if specified
  if (validatedInput.parent_id) {
    const parent = taskRepo.getTaskById(validatedInput.parent_id);
    if (!parent) {
      throw new NotFoundError("Parent task", validatedInput.parent_id);
    }
  }

  const id = randomUUID();
  return taskRepo.createTask(id, validatedInput);
}

export function getTask(id: string): Task {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }
  return task;
}

export function updateTask(id: string, input: UpdateTaskInput): Task {
  const validatedInput = UpdateTaskInput.parse(input);

  // Check if task exists
  const existing = taskRepo.getTaskById(id);
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  // Check optimistic lock
  if (validatedInput.version !== undefined && validatedInput.version !== existing.version) {
    throw new ConflictError(
      `Version mismatch: expected ${validatedInput.version}, got ${existing.version}. Task was modified by another process. Re-read the task and retry with the current version.`
    );
  }

  // Validate parent if being changed
  if (validatedInput.parent_id !== undefined && validatedInput.parent_id !== null) {
    // Prevent self-reference
    if (validatedInput.parent_id === id) {
      throw new ValidationError("Task cannot be its own parent");
    }

    const parent = taskRepo.getTaskById(validatedInput.parent_id);
    if (!parent) {
      throw new NotFoundError("Parent task", validatedInput.parent_id);
    }

    // Check for circular reference
    if (wouldCreateCycle(id, validatedInput.parent_id)) {
      throw new ValidationError("Circular parent reference detected");
    }
  }

  const updated = taskRepo.updateTask(id, validatedInput);
  if (!updated) {
    throw new ConflictError("Concurrent modification detected. Another agent updated this task. Re-read the task and retry.");
  }

  return updated;
}

export function deleteTask(id: string): void {
  const existing = taskRepo.getTaskById(id);
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  const deleted = taskRepo.deleteTask(id);
  if (!deleted) {
    throw new NotFoundError("Task", id);
  }
}

export function listTasks(query: ListTasksQuery = {}): Task[] {
  const validatedQuery = ListTasksQuery.parse(query);
  return taskRepo.listTasks(validatedQuery);
}

export function getTaskChildren(parentId: string): Task[] {
  const parent = taskRepo.getTaskById(parentId);
  if (!parent) {
    throw new NotFoundError("Task", parentId);
  }
  return taskRepo.getTaskChildren(parentId);
}

export function countTasks(query: ListTasksQuery = {}): number {
  return taskRepo.countTasks(query);
}

// State transition operations
export interface TaskTransitionResult {
  task: Task;
  transition: TransitionResult;
}

export function transitionTask(id: string, toStatus: Task["status"]): TaskTransitionResult {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }

  const transitionResult = canTransition(task.status, toStatus);
  if (!transitionResult.valid) {
    throw new ValidationError(transitionResult.reason || "Invalid transition");
  }

  const updated = taskRepo.updateTask(id, { status: toStatus });
  if (!updated) {
    throw new ConflictError("Failed to update task status due to concurrent modification. Re-read the task and retry.");
  }

  return {
    task: updated,
    transition: transitionResult,
  };
}

export function getAvailableTransitions(id: string): { current: Task["status"]; allowed: Task["status"][] } {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }

  return {
    current: task.status,
    allowed: getAllowedTransitions(task.status),
  };
}

// Context operations
export function getTaskContext(id: string): Record<string, unknown> {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }
  return task.context ?? {};
}

export function setTaskContext(id: string, context: Record<string, unknown>): Task {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }

  // Validate context size (64KB limit)
  const contextStr = JSON.stringify(context);
  if (contextStr.length > 65536) {
    throw new ValidationError("Context exceeds 64KB limit");
  }

  const updated = taskRepo.updateTask(id, { context });
  if (!updated) {
    throw new ConflictError("Failed to update context due to concurrent modification. Re-read the task and retry.");
  }
  return updated;
}

export function mergeTaskContext(id: string, context: Record<string, unknown>): Task {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }

  const existingContext = task.context ?? {};
  const mergedContext = deepMerge(existingContext, context);

  // Validate merged context size
  const contextStr = JSON.stringify(mergedContext);
  if (contextStr.length > 65536) {
    throw new ValidationError("Merged context exceeds 64KB limit");
  }

  const updated = taskRepo.updateTask(id, { context: mergedContext });
  if (!updated) {
    throw new ConflictError("Failed to update context due to concurrent modification. Re-read the task and retry.");
  }
  return updated;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
}

export function getTaskTree(taskId: string, maxDepth: number = 5): TaskTreeNode {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }
  return buildTree(task, 0, maxDepth);
}

export function getRootTasks(): Task[] {
  return taskRepo.listTasks({ parent_id: undefined }).filter(t => !t.parent_id);
}

export function getFullTree(maxDepth: number = 5): TaskTreeNode[] {
  const roots = getRootTasks();
  return roots.map(root => buildTree(root, 0, maxDepth));
}

function buildTree(task: Task, depth: number, maxDepth: number): TaskTreeNode {
  const children = depth < maxDepth
    ? taskRepo.getTaskChildren(task.id).map(child => buildTree(child, depth + 1, maxDepth))
    : [];

  return {
    ...task,
    children,
  };
}

// Helper to detect circular parent references
function wouldCreateCycle(taskId: string, newParentId: string): boolean {
  let current: Task | null = taskRepo.getTaskById(newParentId);
  const visited = new Set<string>();

  while (current) {
    if (current.id === taskId) {
      return true; // Cycle detected
    }
    if (visited.has(current.id)) {
      return false; // Already visited, no cycle to taskId
    }
    visited.add(current.id);
    current = current.parent_id ? taskRepo.getTaskById(current.parent_id) : null;
  }

  return false;
}

// Bulk operations
export function createTasksBulk(inputs: CreateTaskInput[]): Task[] {
  if (inputs.length === 0) return [];
  if (inputs.length > 100) {
    throw new ValidationError("Bulk create limited to 100 tasks");
  }

  const tasks = inputs.map(input => ({
    id: randomUUID(),
    input: CreateTaskInput.parse(input),
  }));

  return taskRepo.createTasksBulk(tasks);
}

export function updateTasksBulk(ids: string[], updates: UpdateTaskInput): Task[] {
  if (ids.length === 0) return [];
  const validatedUpdates = UpdateTaskInput.parse(updates);
  return taskRepo.updateTasksBulk(ids, validatedUpdates);
}

export function transitionTasksBulk(
  ids: string[],
  toStatus: Task["status"],
  skipInvalid = false
): { updated: Task[]; failed: Array<{ id: string; reason: string }> } {
  if (ids.length === 0) return { updated: [], failed: [] };

  const updated: Task[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const result = transitionTask(id, toStatus);
      updated.push(result.task);
    } catch (error) {
      if (skipInvalid) {
        failed.push({
          id,
          reason: error instanceof Error ? error.message : String(error),
        });
      } else {
        throw error;
      }
    }
  }

  return { updated, failed };
}

// Dependency operations
export function addDependency(taskId: string, dependsOnId: string): { task_id: string; depends_on_id: string } {
  // Validate both tasks exist
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }
  const dependsOn = taskRepo.getTaskById(dependsOnId);
  if (!dependsOn) {
    throw new NotFoundError("Dependency task", dependsOnId);
  }

  // Prevent self-dependency
  if (taskId === dependsOnId) {
    throw new ValidationError("Task cannot depend on itself");
  }

  // Check for existing dependency
  if (depRepo.hasDependency(taskId, dependsOnId)) {
    throw new ValidationError("Dependency already exists");
  }

  // Check for circular dependency
  if (wouldCreateDependencyCycle(taskId, dependsOnId)) {
    throw new ValidationError("Circular dependency detected");
  }

  depRepo.addDependency(taskId, dependsOnId);
  return { task_id: taskId, depends_on_id: dependsOnId };
}

export function removeDependency(taskId: string, dependsOnId: string): boolean {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  return depRepo.removeDependency(taskId, dependsOnId);
}

export function getTaskDependencies(taskId: string): string[] {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }
  return depRepo.getDependencies(taskId);
}

export function getTaskDependents(taskId: string): string[] {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }
  return depRepo.getDependents(taskId);
}

export function getBlockedTasks(): Task[] {
  const blockedIds = depRepo.getBlockedTasks();
  return blockedIds.map(id => taskRepo.getTaskById(id)).filter((t): t is Task => t !== null);
}

export function getReadyTasks(): Task[] {
  const readyIds = depRepo.getReadyTasks();
  return readyIds.map(id => taskRepo.getTaskById(id)).filter((t): t is Task => t !== null);
}

// Atomic claim - only succeeds if task is unclaimed
export function claimTask(taskId: string, agentId: string): { success: boolean; task: Task; message: string } {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  if (task.agent_id) {
    return {
      success: false,
      task,
      message: task.agent_id === agentId
        ? "Task already claimed by you"
        : `Task already claimed by agent: ${task.agent_id}`,
    };
  }

  const updated = taskRepo.updateTask(taskId, { agent_id: agentId });
  if (!updated) {
    throw new ConflictError("Failed to claim task - concurrent modification");
  }

  return {
    success: true,
    task: updated,
    message: "Task claimed successfully",
  };
}

// Release a claimed task
export function releaseTask(taskId: string, agentId: string): { success: boolean; task: Task; message: string } {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  if (!task.agent_id) {
    return {
      success: false,
      task,
      message: "Task is not claimed",
    };
  }

  if (task.agent_id !== agentId) {
    return {
      success: false,
      task,
      message: `Task is claimed by different agent: ${task.agent_id}`,
    };
  }

  const updated = taskRepo.updateTask(taskId, { agent_id: null });
  if (!updated) {
    throw new ConflictError("Failed to release task - concurrent modification");
  }

  return {
    success: true,
    task: updated,
    message: "Task released successfully",
  };
}

function wouldCreateDependencyCycle(taskId: string, newDependsOnId: string): boolean {
  // Check if newDependsOnId already depends on taskId (directly or transitively)
  const visited = new Set<string>();
  const queue = [newDependsOnId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) {
      return true; // Cycle detected
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const deps = depRepo.getDependencies(current);
    queue.push(...deps);
  }

  return false;
}
