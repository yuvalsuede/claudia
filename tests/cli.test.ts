import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, cleanupTestDb, getTestDbPath } from "./setup";
import { spawnSync } from "child_process";
import { closeDb } from "../src/db/client";
import { join } from "path";

const CLI_PATH = join(process.cwd(), "src/cli/index.ts");
const BUN_PATH = join(process.env.HOME || "", ".bun/bin/bun");

function runCli(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(BUN_PATH, ["run", CLI_PATH, ...args], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
    cwd: process.cwd(),
  });

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.status ?? 0,
  };
}

describe("CLI Task Commands", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("task create outputs JSON", () => {
    const result = runCli(["task", "create", "--title", "CLI Test Task"], { CLAUDIA_DB: dbPath });

    // Check if we got output
    if (result.stdout.trim() === "") {
      console.log("STDERR:", result.stderr);
    }
    expect(result.stdout.trim()).not.toBe("");

    const task = JSON.parse(result.stdout);
    expect(task.title).toBe("CLI Test Task");
    expect(task.id).toBeDefined();
  });

  test("task list returns array", () => {
    // Create a task first
    runCli(["task", "create", "--title", "List test"], { CLAUDIA_DB: dbPath });

    const result = runCli(["task", "list"], { CLAUDIA_DB: dbPath });
    expect(result.stdout.trim()).not.toBe("");

    const tasks = JSON.parse(result.stdout);
    expect(Array.isArray(tasks)).toBe(true);
  });

  test("task show by id", () => {
    const createResult = runCli(["task", "create", "--title", "Show me"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["task", "show", created.id], { CLAUDIA_DB: dbPath });

    const task = JSON.parse(result.stdout);
    expect(task.id).toBe(created.id);
    expect(task.title).toBe("Show me");
  });

  test("task update changes fields", () => {
    const createResult = runCli(["task", "create", "--title", "Update me"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["task", "update", created.id, "--title", "Updated via CLI"], { CLAUDIA_DB: dbPath });

    const task = JSON.parse(result.stdout);
    expect(task.title).toBe("Updated via CLI");
  });

  test("task delete with force flag", () => {
    const createResult = runCli(["task", "create", "--title", "Delete me"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["task", "delete", created.id, "--force"], { CLAUDIA_DB: dbPath });
    expect(result.exitCode).toBe(0);

    // Verify deleted
    const showResult = runCli(["task", "show", created.id], { CLAUDIA_DB: dbPath });
    expect(showResult.exitCode).toBe(2); // NOT_FOUND
  });

  test("task transition changes status", () => {
    const createResult = runCli(["task", "create", "--title", "Transition me"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["task", "transition", created.id, "--to", "in_progress"], { CLAUDIA_DB: dbPath });

    const output = JSON.parse(result.stdout);
    expect(output.task.status).toBe("in_progress");
    expect(output.transition.from).toBe("pending");
    expect(output.transition.to).toBe("in_progress");
  });
});

describe("CLI Output Formats", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("--format yaml outputs YAML", () => {
    const createResult = runCli(["task", "create", "--title", "YAML test"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["task", "show", created.id, "--format", "yaml"], { CLAUDIA_DB: dbPath });
    expect(result.stdout).toContain("title: YAML test");
  });

  test("--format text outputs readable text", () => {
    const createResult = runCli(["task", "create", "--title", "Text test"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["task", "show", created.id, "--format", "text"], { CLAUDIA_DB: dbPath });
    expect(result.stdout).toContain("Text test");
  });
});

describe("CLI Sprint Commands", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("sprint create", () => {
    const result = runCli(["sprint", "create", "--name", "Sprint CLI"], { CLAUDIA_DB: dbPath });

    const sprint = JSON.parse(result.stdout);
    expect(sprint.name).toBe("Sprint CLI");
    expect(sprint.status).toBe("planning");
  });

  test("sprint list", () => {
    runCli(["sprint", "create", "--name", "List sprint"], { CLAUDIA_DB: dbPath });

    const result = runCli(["sprint", "list"], { CLAUDIA_DB: dbPath });

    const sprints = JSON.parse(result.stdout);
    expect(Array.isArray(sprints)).toBe(true);
  });

  test("sprint activate", () => {
    const createResult = runCli(["sprint", "create", "--name", "Activate me"], { CLAUDIA_DB: dbPath });
    const created = JSON.parse(createResult.stdout);

    const result = runCli(["sprint", "activate", created.id], { CLAUDIA_DB: dbPath });

    const sprint = JSON.parse(result.stdout);
    expect(sprint.status).toBe("active");
  });
});

describe("CLI Database Commands", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("db path shows database location", () => {
    const result = runCli(["db", "path"], { CLAUDIA_DB: dbPath });
    const output = JSON.parse(result.stdout);
    expect(output.path).toBe(dbPath);
  });
});

describe("CLI Exit Codes", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("NOT_FOUND (2) for missing resource", () => {
    const result = runCli(["task", "show", "00000000-0000-0000-0000-000000000000"], { CLAUDIA_DB: dbPath });
    expect(result.exitCode).toBe(2);
  });

  test("error for missing required option", () => {
    const result = runCli(["task", "create"], { CLAUDIA_DB: dbPath }); // Missing required --title
    // Commander exits with 1 for missing required options
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("required");
  });
});
