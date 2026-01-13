import { Command } from "commander";
import * as taskService from "../../core/task.js";
import { formatOutput, formatError, formatTree, type OutputFormat } from "../formatters.js";
import { EXIT_CODES } from "../../utils/exit-codes.js";
import { ClaudiaError } from "../../utils/errors.js";
import type { Priority, TaskStatus } from "../../schemas/task.js";

export function createTaskCommand(): Command {
  const task = new Command("task").description("Manage tasks");

  // task create
  task
    .command("create")
    .description("Create a new task")
    .requiredOption("-t, --title <title>", "Task title")
    .option("-d, --description <description>", "Task description")
    .option("-p, --priority <priority>", "Priority (p0, p1, p2, p3)")
    .option("--parent <id>", "Parent task ID")
    .option("--status <status>", "Initial status")
    .option("--assignee <assignee>", "Assignee")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--due <date>", "Due date (ISO8601)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const task = taskService.createTask({
          title: options.title,
          description: options.description,
          priority: options.priority as Priority,
          parent_id: options.parent,
          status: options.status as TaskStatus,
          assignee: options.assignee,
          tags: options.tags ? options.tags.split(",").map((t: string) => t.trim()) : undefined,
          due_at: options.due,
        });
        console.log(formatOutput(task, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task show
  task
    .command("show")
    .description("Show a task by ID")
    .argument("<id>", "Task ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const task = taskService.getTask(id);
        console.log(formatOutput(task, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task list
  task
    .command("list")
    .description("List tasks")
    .option("-s, --status <status>", "Filter by status (comma-separated)")
    .option("-p, --priority <priority>", "Filter by priority (comma-separated)")
    .option("--parent <id>", "Filter by parent task ID")
    .option("--assignee <assignee>", "Filter by assignee")
    .option("--sort <fields>", "Sort by fields (comma-separated, prefix with - for desc)")
    .option("--limit <n>", "Limit results", parseInt)
    .option("--offset <n>", "Offset results", parseInt)
    .option("--include-archived", "Include archived tasks")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const tasks = taskService.listTasks({
          status: options.status
            ? options.status.split(",").map((s: string) => s.trim())
            : undefined,
          priority: options.priority
            ? options.priority.split(",").map((p: string) => p.trim())
            : undefined,
          parent_id: options.parent,
          assignee: options.assignee,
          sort: options.sort
            ? options.sort.split(",").map((s: string) => s.trim())
            : undefined,
          limit: options.limit,
          offset: options.offset,
          include_archived: options.includeArchived,
        });
        console.log(formatOutput(tasks, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task update
  task
    .command("update")
    .description("Update a task")
    .argument("<id>", "Task ID")
    .option("-t, --title <title>", "New title")
    .option("-d, --description <description>", "New description")
    .option("-s, --status <status>", "New status")
    .option("-p, --priority <priority>", "New priority")
    .option("--parent <id>", "New parent task ID (use 'none' to clear)")
    .option("--assignee <assignee>", "New assignee (use 'none' to clear)")
    .option("--tags <tags>", "New tags (comma-separated)")
    .option("--due <date>", "New due date (use 'none' to clear)")
    .option("--version <n>", "Expected version for optimistic locking", parseInt)
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const updates: Record<string, unknown> = {};

        if (options.title) updates.title = options.title;
        if (options.description) updates.description = options.description;
        if (options.status) updates.status = options.status;
        if (options.priority) updates.priority = options.priority;
        if (options.parent !== undefined) {
          updates.parent_id = options.parent === "none" ? null : options.parent;
        }
        if (options.assignee !== undefined) {
          updates.assignee = options.assignee === "none" ? null : options.assignee;
        }
        if (options.tags) {
          updates.tags = options.tags.split(",").map((t: string) => t.trim());
        }
        if (options.due !== undefined) {
          updates.due_at = options.due === "none" ? null : options.due;
        }
        if (options.version !== undefined) {
          updates.version = options.version;
        }

        const task = taskService.updateTask(id, updates);
        console.log(formatOutput(task, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task transition
  task
    .command("transition")
    .description("Transition task to a new status with validation")
    .argument("<id>", "Task ID")
    .requiredOption("--to <status>", "Target status (pending, in_progress, blocked, completed, archived)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const result = taskService.transitionTask(id, options.to as TaskStatus);
        console.log(
          formatOutput(
            {
              task: result.task,
              transition: {
                from: result.transition.from,
                to: result.transition.to,
              },
            },
            options.format as OutputFormat
          )
        );
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task transitions (show available)
  task
    .command("transitions")
    .description("Show available status transitions for a task")
    .argument("<id>", "Task ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const result = taskService.getAvailableTransitions(id);
        console.log(formatOutput(result, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task context get
  task
    .command("context-get")
    .description("Get task context")
    .argument("<id>", "Task ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const context = taskService.getTaskContext(id);
        console.log(formatOutput(context, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task context set
  task
    .command("context-set")
    .description("Set task context (overwrites existing)")
    .argument("<id>", "Task ID")
    .argument("<json>", "Context as JSON string")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, json: string, options) => {
      try {
        const context = JSON.parse(json);
        const task = taskService.setTaskContext(id, context);
        console.log(formatOutput(task, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error(formatError(new Error("Invalid JSON")));
          process.exit(EXIT_CODES.VALIDATION_ERROR);
        }
        handleError(error);
      }
    });

  // task context merge
  task
    .command("context-merge")
    .description("Merge into task context (deep merge)")
    .argument("<id>", "Task ID")
    .argument("<json>", "Context to merge as JSON string")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, json: string, options) => {
      try {
        const context = JSON.parse(json);
        const task = taskService.mergeTaskContext(id, context);
        console.log(formatOutput(task, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error(formatError(new Error("Invalid JSON")));
          process.exit(EXIT_CODES.VALIDATION_ERROR);
        }
        handleError(error);
      }
    });

  // task tree
  task
    .command("tree")
    .description("Show task hierarchy")
    .argument("[id]", "Task ID (shows full tree if omitted)")
    .option("--depth <n>", "Maximum depth", parseInt, 5)
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string | undefined, options) => {
      try {
        if (id) {
          const tree = taskService.getTaskTree(id, options.depth);
          console.log(formatTree(tree, options.format as OutputFormat));
        } else {
          const trees = taskService.getFullTree(options.depth);
          console.log(formatTree(trees, options.format as OutputFormat));
        }
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task delete
  task
    .command("delete")
    .description("Delete a task")
    .argument("<id>", "Task ID")
    .option("--force", "Skip confirmation")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        if (!options.force) {
          console.error("Use --force to confirm deletion");
          process.exit(EXIT_CODES.VALIDATION_ERROR);
        }

        taskService.deleteTask(id);
        console.log(formatOutput({ deleted: true, id }, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task depends (add dependency)
  task
    .command("depends")
    .description("Add a dependency (task depends on another)")
    .argument("<id>", "Task ID")
    .requiredOption("--on <id>", "ID of task this depends on")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const result = taskService.addDependency(id, options.on);
        console.log(formatOutput(result, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task undepends (remove dependency)
  task
    .command("undepends")
    .description("Remove a dependency")
    .argument("<id>", "Task ID")
    .requiredOption("--on <id>", "ID of task to remove dependency from")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const removed = taskService.removeDependency(id, options.on);
        console.log(formatOutput({ removed, task_id: id, depends_on_id: options.on }, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task deps (show dependencies)
  task
    .command("deps")
    .description("Show task dependencies")
    .argument("<id>", "Task ID")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (id: string, options) => {
      try {
        const dependencies = taskService.getTaskDependencies(id);
        const dependents = taskService.getTaskDependents(id);
        console.log(formatOutput({ task_id: id, depends_on: dependencies, blocking: dependents }, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task blocked (list blocked tasks)
  task
    .command("blocked")
    .description("List tasks with unsatisfied dependencies")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const tasks = taskService.getBlockedTasks();
        console.log(formatOutput(tasks, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  // task ready (list ready tasks)
  task
    .command("ready")
    .description("List tasks ready to work on (all deps satisfied)")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const tasks = taskService.getReadyTasks();
        console.log(formatOutput(tasks, options.format as OutputFormat));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        handleError(error);
      }
    });

  return task;
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
