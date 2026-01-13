import { getDb } from "../client.js";
import type { SQLQueryBindings } from "bun:sqlite";

export interface Sprint {
  id: string;
  name: string;
  status: "planning" | "active" | "completed" | "archived";
  project_id?: string;
  start_at?: string;
  end_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSprintInput {
  name: string;
  status?: Sprint["status"];
  project_id?: string;
  start_at?: string;
  end_at?: string;
}

export interface UpdateSprintInput {
  name?: string;
  status?: Sprint["status"];
  project_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
}

interface SprintRow {
  id: string;
  name: string;
  status: string;
  project_id: string | null;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Sprint["status"],
    project_id: row.project_id ?? undefined,
    start_at: row.start_at ?? undefined,
    end_at: row.end_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createSprint(id: string, input: CreateSprintInput): Sprint {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sprints (id, name, status, project_id, start_at, end_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.status ?? "planning",
    input.project_id ?? null,
    input.start_at ?? null,
    input.end_at ?? null,
    now,
    now
  );

  return getSprintById(id)!;
}

export function getSprintById(id: string): Sprint | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sprints WHERE id = ?").get(id) as SprintRow | undefined;
  return row ? rowToSprint(row) : null;
}

export function updateSprint(id: string, input: UpdateSprintInput): Sprint | null {
  const db = getDb();
  const now = new Date().toISOString();

  const updates: string[] = ["updated_at = ?"];
  const values: SQLQueryBindings[] = [now];

  if (input.name !== undefined) {
    updates.push("name = ?");
    values.push(input.name);
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    values.push(input.status);
  }
  if (input.project_id !== undefined) {
    updates.push("project_id = ?");
    values.push(input.project_id);
  }
  if (input.start_at !== undefined) {
    updates.push("start_at = ?");
    values.push(input.start_at);
  }
  if (input.end_at !== undefined) {
    updates.push("end_at = ?");
    values.push(input.end_at);
  }

  values.push(id);
  db.prepare(`UPDATE sprints SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  return getSprintById(id);
}

export function deleteSprint(id: string): boolean {
  const db = getDb();
  // First unassign all tasks from this sprint
  db.prepare("UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?").run(id);
  const result = db.prepare("DELETE FROM sprints WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listSprints(includeArchived = false): Sprint[] {
  const db = getDb();
  const sql = includeArchived
    ? "SELECT * FROM sprints ORDER BY created_at DESC"
    : "SELECT * FROM sprints WHERE status != 'archived' ORDER BY created_at DESC";
  const rows = db.prepare(sql).all() as SprintRow[];
  return rows.map(rowToSprint);
}

export function getActiveSprint(): Sprint | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sprints WHERE status = 'active' LIMIT 1").get() as SprintRow | undefined;
  return row ? rowToSprint(row) : null;
}

export function setActiveSprint(id: string): Sprint | null {
  const db = getDb();
  // Deactivate current active sprint
  db.prepare("UPDATE sprints SET status = 'planning' WHERE status = 'active'").run();
  // Activate the new sprint
  db.prepare("UPDATE sprints SET status = 'active', updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    id
  );
  return getSprintById(id);
}

export function getSprintTaskCounts(sprintId: string): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM tasks
    WHERE sprint_id = ?
    GROUP BY status
  `).all(sprintId) as { status: string; count: number }[];

  const counts: Record<string, number> = {
    pending: 0,
    in_progress: 0,
    blocked: 0,
    completed: 0,
    archived: 0,
    total: 0,
  };

  for (const row of rows) {
    counts[row.status] = row.count;
    counts.total += row.count;
  }

  return counts;
}
