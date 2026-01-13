import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  path: z.string().optional(),
  description: z.string().max(2000).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  path: z.string().optional(),
  description: z.string().max(2000).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(200).optional(),
  path: z.string().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export const ListProjectsQuery = z.object({
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type ListProjectsQuery = z.infer<typeof ListProjectsQuery>;
