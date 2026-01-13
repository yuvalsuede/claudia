import { getDb } from "../client.js";
import type { SQLQueryBindings } from "bun:sqlite";
import type { Task, CreateTaskInput, UpdateTaskInput, ListTasksQuery } from "../../schemas/task.js";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  task_type: string | null;
  parent_id: string | null;
  sprint_id: string | null;
  project_id: string | null;
  due_at: string | null;
  tags: string | null;
  assignee: string | null;
  agent_id: string | null;
  estimate: number | null;
  context: string | null;
  metadata: string | null;
  images: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    task_type: row.task_type as Task["task_type"],
    parent_id: row.parent_id ?? undefined,
    sprint_id: row.sprint_id ?? undefined,
    project_id: row.project_id ?? undefined,
    due_at: row.due_at ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    assignee: row.assignee ?? undefined,
    agent_id: row.agent_id ?? undefined,
    estimate: row.estimate ?? undefined,
    context: row.context ? JSON.parse(row.context) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    images: row.images ? JSON.parse(row.images) : undefined,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createTask(id: string, input: CreateTaskInput): Task {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, title, description, status, priority, task_type, parent_id, sprint_id, project_id,
      due_at, tags, assignee, agent_id, estimate, context, metadata, images, version, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
    )
  `);

  stmt.run(
    id,
    input.title,
    input.description ?? null,
    input.status ?? "pending",
    input.priority ?? null,
    input.task_type ?? null,
    input.parent_id ?? null,
    input.sprint_id ?? null,
    input.project_id ?? null,
    input.due_at ?? null,
    input.tags ? JSON.stringify(input.tags) : null,
    input.assignee ?? null,
    input.agent_id ?? null,
    input.estimate ?? null,
    input.context ? JSON.stringify(input.context) : null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.images ? JSON.stringify(input.images) : null,
    now,
    now
  );

  return getTaskById(id)!;
}

export function getTaskById(id: string): Task | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function updateTask(id: string, input: UpdateTaskInput): Task | null {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = getTaskById(id);
  if (!existing) return null;

  // Check version for optimistic locking if provided
  if (input.version !== undefined && input.version !== existing.version) {
    return null; // Conflict - caller should handle this
  }

  const updates: string[] = ["updated_at = ?", "version = version + 1"];
  const values: SQLQueryBindings[] = [now];

  if (input.title !== undefined) {
    updates.push("title = ?");
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    values.push(input.description);
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    values.push(input.status);
  }
  if (input.priority !== undefined) {
    updates.push("priority = ?");
    values.push(input.priority);
  }
  if (input.task_type !== undefined) {
    updates.push("task_type = ?");
    values.push(input.task_type);
  }
  if (input.parent_id !== undefined) {
    updates.push("parent_id = ?");
    values.push(input.parent_id);
  }
  if (input.sprint_id !== undefined) {
    updates.push("sprint_id = ?");
    values.push(input.sprint_id);
  }
  if (input.project_id !== undefined) {
    updates.push("project_id = ?");
    values.push(input.project_id);
  }
  if (input.due_at !== undefined) {
    updates.push("due_at = ?");
    values.push(input.due_at);
  }
  if (input.tags !== undefined) {
    updates.push("tags = ?");
    values.push(JSON.stringify(input.tags));
  }
  if (input.assignee !== undefined) {
    updates.push("assignee = ?");
    values.push(input.assignee);
  }
  if (input.agent_id !== undefined) {
    updates.push("agent_id = ?");
    values.push(input.agent_id);
  }
  if (input.estimate !== undefined) {
    updates.push("estimate = ?");
    values.push(input.estimate);
  }
  if (input.context !== undefined) {
    updates.push("context = ?");
    values.push(JSON.stringify(input.context));
  }
  if (input.metadata !== undefined) {
    updates.push("metadata = ?");
    values.push(JSON.stringify(input.metadata));
  }
  if (input.images !== undefined) {
    updates.push("images = ?");
    values.push(JSON.stringify(input.images));
  }

  values.push(id);

  db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  return getTaskById(id);
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listTasks(query: ListTasksQuery = {}): Task[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: SQLQueryBindings[] = [];

  // By default, exclude archived tasks unless explicitly requested
  if (!query.include_archived) {
    conditions.push("status != 'archived'");
  }

  if (query.status && query.status.length > 0) {
    conditions.push(`status IN (${query.status.map(() => "?").join(", ")})`);
    values.push(...query.status);
  }

  if (query.priority && query.priority.length > 0) {
    conditions.push(`priority IN (${query.priority.map(() => "?").join(", ")})`);
    values.push(...query.priority);
  }

  if (query.task_type && query.task_type.length > 0) {
    conditions.push(`task_type IN (${query.task_type.map(() => "?").join(", ")})`);
    values.push(...query.task_type);
  }

  if (query.parent_id !== undefined) {
    conditions.push("parent_id = ?");
    values.push(query.parent_id);
  }

  if (query.sprint_id !== undefined) {
    conditions.push("sprint_id = ?");
    values.push(query.sprint_id);
  }

  if (query.project_id !== undefined) {
    conditions.push("project_id = ?");
    values.push(query.project_id);
  }

  if (query.assignee !== undefined) {
    conditions.push("assignee = ?");
    values.push(query.assignee);
  }

  if (query.agent_id !== undefined) {
    conditions.push("agent_id = ?");
    values.push(query.agent_id);
  }

  let sql = "SELECT * FROM tasks";
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  // Sorting
  if (query.sort && query.sort.length > 0) {
    const sortClauses = query.sort.map((field) => {
      const desc = field.startsWith("-");
      const fieldName = desc ? field.slice(1) : field;
      return `${fieldName} ${desc ? "DESC" : "ASC"}`;
    });
    sql += ` ORDER BY ${sortClauses.join(", ")}`;
  } else {
    sql += " ORDER BY created_at DESC";
  }

  // Pagination
  if (query.limit !== undefined) {
    sql += ` LIMIT ?`;
    values.push(query.limit);
  }
  if (query.offset !== undefined) {
    sql += ` OFFSET ?`;
    values.push(query.offset);
  }

  const rows = db.prepare(sql).all(...values) as TaskRow[];
  return rows.map(rowToTask);
}

export function getTaskChildren(parentId: string): Task[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at ASC")
    .all(parentId) as TaskRow[];
  return rows.map(rowToTask);
}

export function countTasks(query: ListTasksQuery = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const values: SQLQueryBindings[] = [];

  if (!query.include_archived) {
    conditions.push("status != 'archived'");
  }

  if (query.status && query.status.length > 0) {
    conditions.push(`status IN (${query.status.map(() => "?").join(", ")})`);
    values.push(...query.status);
  }

  if (query.priority && query.priority.length > 0) {
    conditions.push(`priority IN (${query.priority.map(() => "?").join(", ")})`);
    values.push(...query.priority);
  }

  let sql = "SELECT COUNT(*) as count FROM tasks";
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  const result = db.prepare(sql).get(...values) as { count: number };
  return result.count;
}

// Bulk operations
export function createTasksBulk(tasks: Array<{ id: string; input: CreateTaskInput }>): Task[] {
  const db = getDb();
  const now = new Date().toISOString();
  const results: Task[] = [];

  const transaction = db.transaction(() => {
    for (const { id, input } of tasks) {
      db.prepare(`
        INSERT INTO tasks (
          id, title, description, status, priority, task_type, parent_id, sprint_id, project_id,
          due_at, tags, assignee, agent_id, estimate, context, metadata, images, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        input.title,
        input.description ?? null,
        input.status ?? "pending",
        input.priority ?? null,
        input.task_type ?? null,
        input.parent_id ?? null,
        input.sprint_id ?? null,
        input.project_id ?? null,
        input.due_at ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.assignee ?? null,
        input.agent_id ?? null,
        input.estimate ?? null,
        input.context ? JSON.stringify(input.context) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.images ? JSON.stringify(input.images) : null,
        now,
        now
      );
      results.push(getTaskById(id)!);
    }
  });

  transaction();
  return results;
}

export function updateTasksBulk(ids: string[], updates: UpdateTaskInput): Task[] {
  const db = getDb();
  const now = new Date().toISOString();

  const updateClauses: string[] = ["updated_at = ?", "version = version + 1"];
  const updateValues: SQLQueryBindings[] = [now];

  if (updates.title !== undefined) {
    updateClauses.push("title = ?");
    updateValues.push(updates.title);
  }
  if (updates.description !== undefined) {
    updateClauses.push("description = ?");
    updateValues.push(updates.description);
  }
  if (updates.status !== undefined) {
    updateClauses.push("status = ?");
    updateValues.push(updates.status);
  }
  if (updates.priority !== undefined) {
    updateClauses.push("priority = ?");
    updateValues.push(updates.priority);
  }
  if (updates.parent_id !== undefined) {
    updateClauses.push("parent_id = ?");
    updateValues.push(updates.parent_id);
  }
  if (updates.sprint_id !== undefined) {
    updateClauses.push("sprint_id = ?");
    updateValues.push(updates.sprint_id);
  }
  if (updates.project_id !== undefined) {
    updateClauses.push("project_id = ?");
    updateValues.push(updates.project_id);
  }
  if (updates.assignee !== undefined) {
    updateClauses.push("assignee = ?");
    updateValues.push(updates.assignee);
  }
  if (updates.agent_id !== undefined) {
    updateClauses.push("agent_id = ?");
    updateValues.push(updates.agent_id);
  }

  const placeholders = ids.map(() => "?").join(", ");
  const sql = `UPDATE tasks SET ${updateClauses.join(", ")} WHERE id IN (${placeholders})`;

  db.prepare(sql).run(...updateValues, ...ids);

  return ids.map(id => getTaskById(id)).filter((t): t is Task => t !== null);
}

export function transitionTasksBulk(ids: string[], toStatus: string): { updated: Task[]; failed: string[] } {
  const db = getDb();
  const now = new Date().toISOString();
  const updated: Task[] = [];
  const failed: string[] = [];

  const transaction = db.transaction(() => {
    for (const id of ids) {
      try {
        db.prepare(`
          UPDATE tasks SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?
        `).run(toStatus, now, id);
        const task = getTaskById(id);
        if (task) updated.push(task);
      } catch {
        failed.push(id);
      }
    }
  });

  transaction();
  return { updated, failed };
}
