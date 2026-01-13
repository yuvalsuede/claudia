import { getDb } from "../client.js";
import type { SQLQueryBindings } from "bun:sqlite";
import type { Project, CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from "../../schemas/project.js";

interface ProjectRow {
  id: string;
  name: string;
  path: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path ?? undefined,
    description: row.description ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createProject(id: string, input: CreateProjectInput): Project {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO projects (id, name, path, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.name,
    input.path ?? null,
    input.description ?? null,
    now,
    now
  );

  return getProjectById(id)!;
}

export function getProjectById(id: string): Project | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function getProjectByPath(path: string): Project | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE path = ?").get(path) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function findProjectByPathPrefix(path: string): Project | null {
  const db = getDb();
  // Find project whose path is a prefix of the given path
  const rows = db.prepare("SELECT * FROM projects WHERE path IS NOT NULL ORDER BY length(path) DESC").all() as ProjectRow[];

  for (const row of rows) {
    if (row.path && path.startsWith(row.path)) {
      return rowToProject(row);
    }
  }
  return null;
}

export function updateProject(id: string, input: UpdateProjectInput): Project | null {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = getProjectById(id);
  if (!existing) return null;

  const updates: string[] = ["updated_at = ?"];
  const values: SQLQueryBindings[] = [now];

  if (input.name !== undefined) {
    updates.push("name = ?");
    values.push(input.name);
  }
  if (input.path !== undefined) {
    updates.push("path = ?");
    values.push(input.path);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    values.push(input.description);
  }

  values.push(id);

  db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  return getProjectById(id);
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listProjects(query: ListProjectsQuery = {}): Project[] {
  const db = getDb();
  const values: SQLQueryBindings[] = [];

  let sql = "SELECT * FROM projects ORDER BY name ASC";

  if (query.limit !== undefined) {
    sql += " LIMIT ?";
    values.push(query.limit);
  }
  if (query.offset !== undefined) {
    sql += " OFFSET ?";
    values.push(query.offset);
  }

  const rows = db.prepare(sql).all(...values) as ProjectRow[];
  return rows.map(rowToProject);
}

export function countProjects(): number {
  const db = getDb();
  const result = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
  return result.count;
}
