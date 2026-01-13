import { Command } from "commander";
import * as projectService from "../../core/project.js";
import { formatOutput, formatError, type OutputFormat } from "../formatters.js";
import { EXIT_CODES } from "../../utils/exit-codes.js";
import { ClaudiaError } from "../../utils/errors.js";

export function createProjectCommand(): Command {
  const project = new Command("project").description("Manage projects");

  // project create
  project
    .command("create")
    .description("Create a new project")
    .requiredOption("-n, --name <name>", "Project name")
    .option("-p, --path <path>", "Project directory path (for auto-detection)")
    .option("-d, --description <description>", "Project description")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const project = projectService.createProject({
          name: options.name,
          path: options.path,
          description: options.description,
        });
        console.log(formatOutput(project, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project list
  project
    .command("list")
    .description("List all projects")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const projects = projectService.listProjects();
        console.log(formatOutput(projects, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project show
  project
    .command("show")
    .description("Show project details")
    .argument("<id>", "Project ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const project = projectService.getProject(id);
        console.log(formatOutput(project, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project update
  project
    .command("update")
    .description("Update a project")
    .argument("<id>", "Project ID")
    .option("-n, --name <name>", "New name")
    .option("-p, --path <path>", "New path (use 'none' to clear)")
    .option("-d, --description <description>", "New description (use 'none' to clear)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const updates: Record<string, unknown> = {};
        if (options.name) updates.name = options.name;
        if (options.path !== undefined) {
          updates.path = options.path === "none" ? null : options.path;
        }
        if (options.description !== undefined) {
          updates.description = options.description === "none" ? null : options.description;
        }

        const project = projectService.updateProject(id, updates);
        console.log(formatOutput(project, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project delete
  project
    .command("delete")
    .description("Delete a project")
    .argument("<id>", "Project ID")
    .option("--force", "Skip confirmation")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        if (!options.force) {
          console.error("Use --force to confirm deletion");
          process.exit(EXIT_CODES.VALIDATION_ERROR);
        }

        projectService.deleteProject(id);
        console.log(formatOutput({ deleted: true, id }, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project select
  project
    .command("select")
    .description("Select a project as current context")
    .argument("<id>", "Project ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const project = projectService.selectProject(id);
        console.log(formatOutput(project, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project current
  project
    .command("current")
    .description("Show the current project context")
    .option("--cwd <path>", "Working directory for auto-detection")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const context = projectService.getProjectContext(options.cwd);
        console.log(formatOutput(context, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // project detect
  project
    .command("detect")
    .description("Auto-detect and select project from directory")
    .option("--cwd <path>", "Working directory (defaults to current directory)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const cwd = options.cwd || process.cwd();
        const project = projectService.autoDetectProject(cwd);
        if (project) {
          console.log(formatOutput({ detected: true, project }, options.format as OutputFormat));
        } else {
          console.log(formatOutput({ detected: false, project: null, cwd }, options.format as OutputFormat));
        }
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  return project;
}

function handleError(error: unknown): never {
  if (error instanceof ClaudiaError) {
    console.error(formatError(error));
    process.exit(error.exitCode);
  }

  const genericError = error instanceof Error ? error : new Error(String(error));
  console.error(formatError(genericError));
  process.exit(EXIT_CODES.GENERAL_ERROR);
}
