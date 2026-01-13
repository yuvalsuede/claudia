import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { runMigrations } from "./migrations.js";

const DEFAULT_DB_PATH = join(homedir(), ".claudia", "tasks.db");

let db: Database | null = null;

export function getDbPath(): string {
  return process.env.CLAUDIA_DB || DEFAULT_DB_PATH;
}

export function getDb(): Database {
  if (!db) {
    const dbPath = getDbPath();
    const dbDir = dirname(dbPath);

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    runMigrations(db);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function initDb(): { path: string; created: boolean } {
  const dbPath = getDbPath();
  const existed = existsSync(dbPath);
  getDb(); // This will create and migrate the database
  return { path: dbPath, created: !existed };
}
