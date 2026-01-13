import { z } from "zod";

export const SprintStatus = z.enum(["planning", "active", "completed", "archived"]);
export type SprintStatus = z.infer<typeof SprintStatus>;

export const SprintSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: SprintStatus.default("planning"),
  project_id: z.string().uuid().optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Sprint = z.infer<typeof SprintSchema>;

export const CreateSprintInput = z.object({
  name: z.string().min(1).max(200),
  status: SprintStatus.optional(),
  project_id: z.string().uuid().optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
});

export type CreateSprintInput = z.infer<typeof CreateSprintInput>;

export const UpdateSprintInput = z.object({
  name: z.string().min(1).max(200).optional(),
  status: SprintStatus.optional(),
  project_id: z.string().uuid().nullable().optional(),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
});

export type UpdateSprintInput = z.infer<typeof UpdateSprintInput>;
