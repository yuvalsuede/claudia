import { z } from "zod";

export const TaskStatus = z.enum([
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "archived",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Priority = z.enum(["p0", "p1", "p2", "p3"]);
export type Priority = z.infer<typeof Priority>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(10240).optional(),
  status: TaskStatus.default("pending"),
  priority: Priority.optional(),
  parent_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  due_at: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  agent_id: z.string().optional(), // Agent that owns/claimed this task
  estimate: z.number().int().positive().optional(),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  version: z.number().int().positive().default(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10240).optional(),
  status: TaskStatus.optional(),
  priority: Priority.optional(),
  parent_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  due_at: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  agent_id: z.string().optional(),
  estimate: z.number().int().positive().optional(),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10240).optional(),
  status: TaskStatus.optional(),
  priority: Priority.optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sprint_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().nullable().optional(),
  agent_id: z.string().nullable().optional(),
  estimate: z.number().int().positive().nullable().optional(),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  version: z.number().int().positive().optional(), // For optimistic locking
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const ListTasksQuery = z.object({
  status: z.array(TaskStatus).optional(),
  priority: z.array(Priority).optional(),
  parent_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  agent_id: z.string().optional(), // Filter by owning agent
  fields: z.array(z.string()).optional(),
  sort: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  include_archived: z.boolean().optional(),
});

export type ListTasksQuery = z.infer<typeof ListTasksQuery>;
