import type { TaskStatus } from "../schemas/task.js";

// Define valid state transitions
// Default workflow: pending → in_progress → completed; any → blocked; any → archived
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "blocked", "archived"],
  in_progress: ["pending", "completed", "blocked", "archived"],
  blocked: ["pending", "in_progress", "archived"],
  completed: ["in_progress", "archived"], // Allow reopening
  archived: [], // Terminal state - no transitions out
};

export interface TransitionResult {
  valid: boolean;
  from: TaskStatus;
  to: TaskStatus;
  reason?: string;
}

export function canTransition(from: TaskStatus, to: TaskStatus): TransitionResult {
  if (from === to) {
    return {
      valid: false,
      from,
      to,
      reason: `Task is already in '${to}' status`,
    };
  }

  const allowedTargets = VALID_TRANSITIONS[from];
  if (!allowedTargets || !allowedTargets.includes(to)) {
    return {
      valid: false,
      from,
      to,
      reason: `Cannot transition from '${from}' to '${to}'. Allowed: ${allowedTargets?.join(", ") || "none"}`,
    };
  }

  return { valid: true, from, to };
}

export function getAllowedTransitions(from: TaskStatus): TaskStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

export function getWorkflowDefinition(): Record<TaskStatus, TaskStatus[]> {
  return { ...VALID_TRANSITIONS };
}
