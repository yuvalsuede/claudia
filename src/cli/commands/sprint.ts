import { Command } from "commander";
import * as sprintService from "../../core/sprint.js";
import { formatOutput, formatError, type OutputFormat } from "../formatters.js";
import { EXIT_CODES } from "../../utils/exit-codes.js";
import { ClaudiaError } from "../../utils/errors.js";
import type { SprintStatus } from "../../schemas/sprint.js";

export function createSprintCommand(): Command {
  const sprint = new Command("sprint").description("Manage sprints");

  // sprint create
  sprint
    .command("create")
    .description("Create a new sprint")
    .requiredOption("-n, --name <name>", "Sprint name")
    .option("--start <date>", "Start date (ISO8601)")
    .option("--end <date>", "End date (ISO8601)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const sprint = sprintService.createSprint({
          name: options.name,
          start_at: options.start,
          end_at: options.end,
        });
        console.log(formatOutput(sprint, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // sprint list
  sprint
    .command("list")
    .description("List all sprints")
    .option("--include-archived", "Include archived sprints")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const sprints = sprintService.listSprintsWithCounts(options.includeArchived);
        console.log(formatOutput(sprints, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // sprint show
  sprint
    .command("show")
    .description("Show sprint details with tasks")
    .argument("<id>", "Sprint ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const sprint = sprintService.getSprintWithTasks(id);
        console.log(formatOutput(sprint, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // sprint update
  sprint
    .command("update")
    .description("Update a sprint")
    .argument("<id>", "Sprint ID")
    .option("-n, --name <name>", "New name")
    .option("-s, --status <status>", "New status (planning, active, completed, archived)")
    .option("--start <date>", "New start date (use 'none' to clear)")
    .option("--end <date>", "New end date (use 'none' to clear)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const updates: Record<string, unknown> = {};
        if (options.name) updates.name = options.name;
        if (options.status) updates.status = options.status as SprintStatus;
        if (options.start !== undefined) {
          updates.start_at = options.start === "none" ? null : options.start;
        }
        if (options.end !== undefined) {
          updates.end_at = options.end === "none" ? null : options.end;
        }

        const sprint = sprintService.updateSprint(id, updates);
        console.log(formatOutput(sprint, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // sprint delete
  sprint
    .command("delete")
    .description("Delete a sprint (tasks are unassigned)")
    .argument("<id>", "Sprint ID")
    .option("--force", "Skip confirmation")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        if (!options.force) {
          console.error("Use --force to confirm deletion");
          process.exit(EXIT_CODES.VALIDATION_ERROR);
        }

        sprintService.deleteSprint(id);
        console.log(formatOutput({ deleted: true, id }, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // sprint activate
  sprint
    .command("activate")
    .description("Set a sprint as the active sprint")
    .argument("<id>", "Sprint ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const sprint = sprintService.activateSprint(id);
        console.log(formatOutput(sprint, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // sprint active
  sprint
    .command("active")
    .description("Show the current active sprint")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const sprint = sprintService.getActiveSprint();
        if (!sprint) {
          console.log(formatOutput({ active: null }, options.format as OutputFormat));
        } else {
          console.log(formatOutput(sprint, options.format as OutputFormat));
        }
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  return sprint;
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
