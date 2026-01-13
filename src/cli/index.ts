#!/usr/bin/env bun
import { Command } from "commander";
import { createTaskCommand } from "./commands/task.js";
import { createDbCommand } from "./commands/db.js";
import { createMcpCommand } from "./commands/mcp.js";
import { createSprintCommand } from "./commands/sprint.js";
import { closeDb } from "../db/client.js";

const program = new Command();

program
  .name("claudia")
  .description("CLI task manager for AI agents")
  .version("0.1.0");

program.addCommand(createTaskCommand());
program.addCommand(createSprintCommand());
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
