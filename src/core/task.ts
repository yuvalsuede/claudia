import { randomUUID } from "crypto";
import * as taskRepo from "../db/repositories/task.repo.js";
import * as depRepo from "../db/repositories/dependency.repo.js";
import {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
  type Task,
  type AcceptanceCriterion,
} from "../schemas/task.js";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors.js";
import { canTransition, getAllowedTransitions } from "./workflow.js";
import type { TransitionResult } from "./workflow.js";
import { getCurrentProjectId } from "./project.js";

export function createTask(input: CreateTaskInput): Task {
  const validatedInput = CreateTaskInput.parse(input);

  // Validate parent exists if specified
  if (validatedInput.parent_id) {
    const parent = taskRepo.getTaskById(validatedInput.parent_id);
    if (!parent) {
      throw new NotFoundError("Parent task", validatedInput.parent_id);
    }
  }

  // Auto-assign current project if none specified
  const taskInput = {
    ...validatedInput,
    project_id: validatedInput.project_id ?? getCurrentProjectId() ?? undefined,
  };

  const id = randomUUID();
  return taskRepo.createTask(id, taskInput);
}

// COMPOUND OPERATION (REQ-007): Create and start working on a task in one operation
export function startTask(input: CreateTaskInput, agentId: string): Task {
  const validatedInput = CreateTaskInput.parse(input);

  // Auto-assign current project if none specified
  const taskInput = {
    ...validatedInput,
    project_id: validatedInput.project_id ?? getCurrentProjectId() ?? undefined,
    status: "in_progress" as const,  // Start immediately in progress
    agent_id: agentId,               // Claim for this agent
  };

  const id = randomUUID();
  return taskRepo.createTask(id, taskInput);
}

// COMPOUND OPERATION (REQ-007): Complete a task with summary
export function finishTask(id: string, agentId: string, summary?: string): Task {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }

  // Verify agent owns this task
  if (task.agent_id && task.agent_id !== agentId) {
    throw new ConflictError(`Task is claimed by another agent: ${task.agent_id}`);
  }

  // Task must be in_progress to finish
  if (task.status !== "in_progress") {
    throw new ValidationError(`Cannot finish task with status '${task.status}'. Task must be in_progress.`);
  }

  // TODO: Add acceptance criteria verification here (REQ-010)
  // For now, just transition to completed

  const updates: Record<string, unknown> = { status: "completed" };
  if (summary) {
    // Store summary in context
    const existingContext = task.context ?? {};
    updates.context = { ...existingContext, completion_summary: summary };
  }

  const updated = taskRepo.updateTask(id, updates);
  if (!updated) {
    throw new ConflictError("Failed to complete task");
  }
  return updated;
}

// VERIFICATION (REQ-010): Verify an acceptance criterion
export interface VerificationResult {
  task: Task;
  criterion: AcceptanceCriterion;
  all_verified: boolean;
  verification_progress: { verified: number; total: number };
}

export function verifyTaskCriterion(
  taskId: string,
  criterionId: string,
  agentId: string,
  evidence?: string
): VerificationResult {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  if (!task.acceptance_criteria || task.acceptance_criteria.length === 0) {
    throw new ValidationError("Task has no acceptance criteria defined");
  }

  const criterionIndex = task.acceptance_criteria.findIndex(c => c.id === criterionId);
  if (criterionIndex === -1) {
    throw new NotFoundError("Criterion", criterionId);
  }

  const criterion = task.acceptance_criteria[criterionIndex];
  if (criterion.verified) {
    // Already verified - return current state
    const verified = task.acceptance_criteria.filter(c => c.verified).length;
    return {
      task,
      criterion,
      all_verified: verified === task.acceptance_criteria.length,
      verification_progress: { verified, total: task.acceptance_criteria.length },
    };
  }

  // Update the criterion
  const updatedCriteria: AcceptanceCriterion[] = [...task.acceptance_criteria];
  updatedCriteria[criterionIndex] = {
    ...criterion,
    verified: true,
    verified_at: new Date().toISOString(),
    verified_by: agentId,
    evidence: evidence,
  };

  const updatedTask = taskRepo.updateTask(taskId, { acceptance_criteria: updatedCriteria });
  if (!updatedTask) {
    throw new ConflictError("Failed to update verification status");
  }

  const verified = updatedCriteria.filter(c => c.verified).length;
  return {
    task: updatedTask,
    criterion: updatedCriteria[criterionIndex],
    all_verified: verified === updatedCriteria.length,
    verification_progress: { verified, total: updatedCriteria.length },
  };
}

// Get verification status for a task
export function getVerificationStatus(taskId: string): {
  has_criteria: boolean;
  criteria: AcceptanceCriterion[];
  all_verified: boolean;
  progress: { verified: number; total: number };
} {
  const task = taskRepo.getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  if (!task.acceptance_criteria || task.acceptance_criteria.length === 0) {
    return {
      has_criteria: false,
      criteria: [],
      all_verified: true, // No criteria means nothing to verify
      progress: { verified: 0, total: 0 },
    };
  }

  const verified = task.acceptance_criteria.filter(c => c.verified).length;
  return {
    has_criteria: true,
    criteria: task.acceptance_criteria,
    all_verified: verified === task.acceptance_criteria.length,
    progress: { verified, total: task.acceptance_criteria.length },
  };
}

export function getTask(id: string): Task {
  const task = taskRepo.getTaskById(id);
  if (!task) {
    throw new NotFoundError("Task", id);
  }
  return task;
}

export function updateTask(id: string, input: UpdateTaskInput, agentId?: string): Task {
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

  // IMPLICIT WORKFLOW (REQ-005): Auto-claim pending tasks on mutation
  // If task is pending and we're mutating it, auto-claim and transition to in_progress
  let implicitUpdates: Partial<UpdateTaskInput> = {};
  if (existing.status === "pending" && agentId) {
    // Check if already claimed by another agent
    if (existing.agent_id && existing.agent_id !== agentId) {
      throw new ConflictError(`Task is claimed by another agent: ${existing.agent_id}`);
    }
    // Auto-claim and transition
    implicitUpdates = {
      status: "in_progress",
      agent_id: agentId,
    };
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

  // Merge implicit updates with explicit updates (explicit wins)
  const finalUpdates = { ...implicitUpdates, ...validatedInput };

  const updated = taskRepo.updateTask(id, finalUpdates);
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

  // Apply current project filter if not explicitly specified
  const projectId = getCurrentProjectId();
  const queryWithProject = projectId && validatedQuery.project_id === undefined
    ? { ...validatedQuery, project_id: projectId }
    : validatedQuery;

  return taskRepo.listTasks(queryWithProject);
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
  const projectId = getCurrentProjectId();
  const query = projectId ? { project_id: projectId } : {};
  return taskRepo.listTasks(query).filter(t => !t.parent_id);
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

  const currentProjectId = getCurrentProjectId();
  const tasks = inputs.map(input => {
    const validated = CreateTaskInput.parse(input);
    return {
      id: randomUUID(),
      input: {
        ...validated,
        project_id: validated.project_id ?? currentProjectId ?? undefined,
      },
    };
  });

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
  const tasks = blockedIds.map(id => taskRepo.getTaskById(id)).filter((t): t is Task => t !== null);

  // Filter by current project if one is selected
  const projectId = getCurrentProjectId();
  return projectId ? tasks.filter(t => t.project_id === projectId) : tasks;
}

export function getReadyTasks(): Task[] {
  const readyIds = depRepo.getReadyTasks();
  const tasks = readyIds.map(id => taskRepo.getTaskById(id)).filter((t): t is Task => t !== null);

  // Filter by current project if one is selected
  const projectId = getCurrentProjectId();
  return projectId ? tasks.filter(t => t.project_id === projectId) : tasks;
}

// Atomic claim - only succeeds if task is unclaimed
// IMPORTANT: Automatically transitions task to in_progress when claimed
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

  // Claim AND transition to in_progress in one operation
  const updated = taskRepo.updateTask(taskId, {
    agent_id: agentId,
    status: "in_progress"
  });
  if (!updated) {
    throw new ConflictError("Failed to claim task - concurrent modification");
  }

  return {
    success: true,
    task: updated,
    message: "Task claimed and moved to in_progress",
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

// SESSION CONTEXT (REQ-003): Get workspace context for a session
export interface WorkspaceContext {
  session_agent_id: string;
  current_project: { id: string; name: string; path?: string } | null;
  my_tasks: Task[];           // Tasks claimed by this session
  orphaned_tasks: Task[];     // in_progress tasks with no/different agent
  pending_tasks: Task[];      // Ready to work on
  recently_completed?: Task[]; // Completed in last 24h
  suggested_actions: string[];
}

export function getWorkspaceContext(sessionAgentId: string, includeCompleted?: boolean): WorkspaceContext {
  // Get current project
  const currentProjectId = getCurrentProjectId();
  let currentProject: WorkspaceContext["current_project"] = null;

  if (currentProjectId) {
    const projectTasks = listTasks({ limit: 1 });
    // We need project info - let's get it from the first task or query
    currentProject = { id: currentProjectId, name: currentProjectId }; // TODO: Get actual project name
  }

  // Get all in_progress tasks
  const inProgressTasks = listTasks({ status: ["in_progress"] });

  // Split into my tasks vs orphaned
  const myTasks = inProgressTasks.filter(t => t.agent_id === sessionAgentId);
  const orphanedTasks = inProgressTasks.filter(t => !t.agent_id || (t.agent_id !== sessionAgentId && t.agent_id.startsWith("session-")));

  // Get pending tasks (ready to work on)
  const pendingTasks = listTasks({ status: ["pending"], limit: 10 });

  // Get recently completed if requested
  let recentlyCompleted: Task[] | undefined;
  if (includeCompleted) {
    const allCompleted = listTasks({ status: ["completed"], limit: 20 });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    recentlyCompleted = allCompleted.filter(t => t.updated_at > oneDayAgo);
  }

  // Generate suggested actions
  const suggestedActions: string[] = [];

  if (orphanedTasks.length > 0) {
    suggestedActions.push(`Resume ${orphanedTasks.length} orphaned in_progress task(s) - they may need attention`);
  }

  if (myTasks.length > 0) {
    suggestedActions.push(`Continue working on ${myTasks.length} task(s) you already claimed`);
  } else if (pendingTasks.length > 0) {
    const highPriority = pendingTasks.filter(t => t.priority === "p0" || t.priority === "p1");
    if (highPriority.length > 0) {
      suggestedActions.push(`Start with high-priority pending tasks (${highPriority.length} P0/P1 tasks available)`);
    } else {
      suggestedActions.push(`Pick a pending task to work on (${pendingTasks.length} available)`);
    }
  } else {
    suggestedActions.push("No pending tasks - create new tasks or check other projects");
  }

  return {
    session_agent_id: sessionAgentId,
    current_project: currentProject,
    my_tasks: myTasks,
    orphaned_tasks: orphanedTasks,
    pending_tasks: pendingTasks,
    recently_completed: recentlyCompleted,
    suggested_actions: suggestedActions,
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
