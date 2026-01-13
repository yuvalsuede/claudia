import type { Database } from "bun:sqlite";

interface Migration {
  version: number;
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT,
        parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        sprint_id TEXT,
        due_at TEXT,
        tags TEXT,
        assignee TEXT,
        estimate INTEGER,
        context TEXT,
        metadata TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

      CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planning',
        start_at TEXT,
        end_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (task_id, depends_on_id)
      );

      CREATE TABLE IF NOT EXISTS file_links (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        line INTEGER,
        linked_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_file_links_task_id ON file_links(task_id);

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: "add_agent_id",
    up: `
      ALTER TABLE tasks ADD COLUMN agent_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
    `,
  },
  {
    version: 3,
    name: "add_projects",
    up: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

      ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

      ALTER TABLE sprints ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
    `,
  },
  {
    version: 4,
    name: "add_task_type_and_images",
    up: `
      ALTER TABLE tasks ADD COLUMN task_type TEXT;
      ALTER TABLE tasks ADD COLUMN images TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
    `,
  },
];

export function runMigrations(db: Database): void {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row: unknown) => (row as { version: number }).version)
  );

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.transaction(() => {
        db.exec(migration.up);
        db.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
        ).run(migration.version, migration.name, new Date().toISOString());
      })();
    }
  }
}

export function getCurrentSchemaVersion(db: Database): number {
  const result = db
    .prepare("SELECT MAX(version) as version FROM schema_migrations")
    .get() as { version: number | null };
  return result?.version ?? 0;
}
