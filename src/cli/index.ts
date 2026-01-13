#!/usr/bin/env bun
import { Command } from "commander";
import { createTaskCommand } from "./commands/task.js";
import { createDbCommand } from "./commands/db.js";
import { createMcpCommand } from "./commands/mcp.js";
import { createSprintCommand } from "./commands/sprint.js";
import { createProjectCommand } from "./commands/project.js";
import { closeDb } from "../db/client.js";
import * as taskService from "../core/task.js";
import { formatOutput, type OutputFormat } from "./formatters.js";
import { EXIT_CODES } from "../utils/exit-codes.js";

const program = new Command();

program
  .name("claudia")
  .description("CLI task manager for Claude")
  .version("0.1.0");

// Quick add shortcut: claudia !! "task title"
program
  .command("!!")
  .description("Quick add a task (shorthand for task create)")
  .argument("<title>", "Task title")
  .option("-p, --priority <priority>", "Priority (p0, p1, p2, p3)", "p1")
  .action((title: string, options: { priority?: string }) => {
    try {
      const task = taskService.createTask({
        title,
        priority: options.priority as "p0" | "p1" | "p2" | "p3",
      });
      console.log(formatOutput(task, "json" as OutputFormat));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

// Quick list shortcut: claudia ?? (shows pending/in_progress tasks)
program
  .command("??")
  .description("Quick list pending and in-progress tasks")
  .action(() => {
    try {
      const tasks = taskService.listTasks({
        status: ["pending", "in_progress"],
      });
      console.log(formatOutput(tasks, "json" as OutputFormat));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

// Quick done shortcut: claudia ok <id>
program
  .command("ok")
  .description("Mark a task as completed")
  .argument("<id>", "Task ID (full or partial)")
  .action((id: string) => {
    try {
      const result = taskService.transitionTask(id, "completed");
      console.log(formatOutput(result.task, "json" as OutputFormat));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

// Quick work-in-progress shortcut: claudia wip <id>
program
  .command("wip")
  .description("Mark a task as in-progress")
  .argument("<id>", "Task ID (full or partial)")
  .action((id: string) => {
    try {
      const result = taskService.transitionTask(id, "in_progress");
      console.log(formatOutput(result.task, "json" as OutputFormat));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program.addCommand(createTaskCommand());
program.addCommand(createSprintCommand());
program.addCommand(createProjectCommand());
program.addCommand(createDbCommand());
program.addCommand(createMcpCommand());

// Ensure database is closed on exit
process.on("exit", () => {
  closeDb();
});

process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

program.parse();
