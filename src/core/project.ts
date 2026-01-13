import { randomUUID } from "crypto";
import * as projectRepo from "../db/repositories/project.repo.js";
import {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsQuery,
  type Project,
} from "../schemas/project.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

// Current project context (in-memory for MCP session)
let currentProjectId: string | null = null;

export function createProject(input: CreateProjectInput): Project {
  const validatedInput = CreateProjectInput.parse(input);

  // Check for duplicate path if provided
  if (validatedInput.path) {
    const existing = projectRepo.getProjectByPath(validatedInput.path);
    if (existing) {
      throw new ValidationError(`Project with path "${validatedInput.path}" already exists: ${existing.name}`);
    }
  }

  const id = randomUUID();
  return projectRepo.createProject(id, validatedInput);
}

export function getProject(id: string): Project {
  const project = projectRepo.getProjectById(id);
  if (!project) {
    throw new NotFoundError("Project", id);
  }
  return project;
}

export function getProjectByPath(path: string): Project | null {
  return projectRepo.getProjectByPath(path);
}

export function findProjectForDirectory(directory: string): Project | null {
  // First try exact match
  const exact = projectRepo.getProjectByPath(directory);
  if (exact) return exact;

  // Then try prefix match (directory is inside a project)
  return projectRepo.findProjectByPathPrefix(directory);
}

export function updateProject(id: string, input: UpdateProjectInput): Project {
  const validatedInput = UpdateProjectInput.parse(input);

  const existing = projectRepo.getProjectById(id);
  if (!existing) {
    throw new NotFoundError("Project", id);
  }

  // Check for duplicate path if being changed
  if (validatedInput.path !== undefined && validatedInput.path !== null && validatedInput.path !== existing.path) {
    const pathConflict = projectRepo.getProjectByPath(validatedInput.path);
    if (pathConflict) {
      throw new ValidationError(`Project with path "${validatedInput.path}" already exists: ${pathConflict.name}`);
    }
  }

  const updated = projectRepo.updateProject(id, validatedInput);
  if (!updated) {
    throw new NotFoundError("Project", id);
  }

  return updated;
}

export function deleteProject(id: string): void {
  const existing = projectRepo.getProjectById(id);
  if (!existing) {
    throw new NotFoundError("Project", id);
  }

  // Clear current project if deleting it
  if (currentProjectId === id) {
    currentProjectId = null;
  }

  const deleted = projectRepo.deleteProject(id);
  if (!deleted) {
    throw new NotFoundError("Project", id);
  }
}

export function listProjects(query: ListProjectsQuery = {}): Project[] {
  const validatedQuery = ListProjectsQuery.parse(query);
  return projectRepo.listProjects(validatedQuery);
}

export function countProjects(): number {
  return projectRepo.countProjects();
}

// Project context management
export function selectProject(id: string): Project {
  const project = getProject(id);
  currentProjectId = project.id;
  return project;
}

export function selectProjectByPath(path: string): Project | null {
  const project = findProjectForDirectory(path);
  if (project) {
    currentProjectId = project.id;
  }
  return project;
}

export function getCurrentProject(): Project | null {
  if (!currentProjectId) return null;
  return projectRepo.getProjectById(currentProjectId);
}

export function getCurrentProjectId(): string | null {
  return currentProjectId;
}

export function clearCurrentProject(): void {
  currentProjectId = null;
}

// Auto-detect project from working directory
export function autoDetectProject(cwd: string): Project | null {
  const project = findProjectForDirectory(cwd);
  if (project) {
    currentProjectId = project.id;
  }
  return project;
}

// Get current project context for MCP tools
export interface ProjectContext {
  project: Project | null;
  detected: boolean;
  available: Project[];
  prompt?: string;
}

export function getProjectContext(cwd?: string): ProjectContext {
  let project = getCurrentProject();
  let detected = false;

  // Try auto-detection if no project selected and cwd provided
  if (!project && cwd) {
    project = autoDetectProject(cwd);
    detected = !!project;
  }

  const available = listProjects();

  // Generate prompt if no project is selected
  let prompt: string | undefined;
  if (!project && available.length > 0) {
    prompt = "No project selected. Please select a project to work on:\n" +
      available.map((p, i) => `  ${i + 1}. ${p.name}${p.path ? ` (${p.path})` : ""}`).join("\n") +
      "\n\nUse project_select with the project ID to select a project.";
  } else if (!project && available.length === 0) {
    prompt = "No projects found. Create a project first using project_create with a name and optional path.";
  }

  return {
    project,
    detected,
    available,
    ...(prompt && { prompt }),
  };
}
