import { getDb } from "../client.js";

export interface Dependency {
  task_id: string;
  depends_on_id: string;
  created_at: string;
}

export function addDependency(taskId: string, dependsOnId: string): Dependency {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO task_dependencies (task_id, depends_on_id, created_at) VALUES (?, ?, ?)"
  ).run(taskId, dependsOnId, now);

  return { task_id: taskId, depends_on_id: dependsOnId, created_at: now };
}

export function removeDependency(taskId: string, dependsOnId: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?")
    .run(taskId, dependsOnId);
  return result.changes > 0;
}

export function getDependencies(taskId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT depends_on_id FROM task_dependencies WHERE task_id = ?")
    .all(taskId) as { depends_on_id: string }[];
  return rows.map((r) => r.depends_on_id);
}

export function getDependents(taskId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT task_id FROM task_dependencies WHERE depends_on_id = ?")
    .all(taskId) as { task_id: string }[];
  return rows.map((r) => r.task_id);
}

export function hasDependency(taskId: string, dependsOnId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?")
    .get(taskId, dependsOnId);
  return !!row;
}

export function getBlockedTasks(): string[] {
  const db = getDb();
  // Tasks that have at least one incomplete dependency
  const rows = db.prepare(`
    SELECT DISTINCT td.task_id
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_id = t.id
    WHERE t.status NOT IN ('completed', 'archived')
  `).all() as { task_id: string }[];
  return rows.map((r) => r.task_id);
}

export function getReadyTasks(): string[] {
  const db = getDb();
  // Tasks that have no dependencies, or all dependencies are completed
  const rows = db.prepare(`
    SELECT t.id
    FROM tasks t
    WHERE t.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM task_dependencies td
      JOIN tasks dep ON td.depends_on_id = dep.id
      WHERE td.task_id = t.id
      AND dep.status NOT IN ('completed', 'archived')
    )
  `).all() as { id: string }[];
  return rows.map((r) => r.id);
}
