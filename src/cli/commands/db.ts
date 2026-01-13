import { Command } from "commander";
import { initDb, getDbPath } from "../../db/client.js";
import { formatOutput, type OutputFormat } from "../formatters.js";
import { EXIT_CODES } from "../../utils/exit-codes.js";
import { copyFileSync, existsSync } from "fs";

export function createDbCommand(): Command {
  const db = new Command("db").description("Database management");

  // db init
  db.command("init")
    .description("Initialize the database")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const result = initDb();
        console.log(
          formatOutput(
            {
              initialized: true,
              path: result.path,
              created: result.created,
            },
            options.format as OutputFormat
          )
        );
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        console.error(
          formatOutput(
            {
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
            },
            options.format as OutputFormat
          )
        );
        process.exit(EXIT_CODES.STORAGE_ERROR);
      }
    });

  // db backup
  db.command("backup")
    .description("Create a backup of the database")
    .option("-o, --output <path>", "Output path for backup")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      try {
        const dbPath = getDbPath();

        if (!existsSync(dbPath)) {
          console.error(
            formatOutput(
              {
                error: { message: "Database does not exist. Run 'claudia db init' first." },
              },
              options.format as OutputFormat
            )
          );
          process.exit(EXIT_CODES.STORAGE_ERROR);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = options.output || `${dbPath}.backup-${timestamp}`;

        copyFileSync(dbPath, backupPath);

        console.log(
          formatOutput(
            {
              backed_up: true,
              source: dbPath,
              destination: backupPath,
            },
            options.format as OutputFormat
          )
        );
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        console.error(
          formatOutput(
            {
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
            },
            options.format as OutputFormat
          )
        );
        process.exit(EXIT_CODES.STORAGE_ERROR);
      }
    });

  // db path
  db.command("path")
    .description("Show database path")
    .option("-f, --format <format>", "Output format (json, yaml, text)", "json")
    .action(async (options) => {
      const dbPath = getDbPath();
      const exists = existsSync(dbPath);
      console.log(formatOutput({ path: dbPath, exists }, options.format as OutputFormat));
      process.exit(EXIT_CODES.SUCCESS);
    });

  return db;
}
