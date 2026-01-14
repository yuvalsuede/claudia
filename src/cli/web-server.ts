import * as taskService from "../core/task.js";
import * as projectService from "../core/project.js";
import type { Task } from "../schemas/task.js";
import type { Project } from "../schemas/project.js";

const STATUS_COLORS: Record<string, string> = {
  pending: "#fbbf24",
  in_progress: "#3b82f6",
  blocked: "#ef4444",
  completed: "#22c55e",
  archived: "#6b7280",
};

const TYPE_COLORS: Record<string, string> = {
  feature: "#8b5cf6",
  bugfix: "#ef4444",
  planning: "#06b6d4",
  development: "#3b82f6",
  ui: "#ec4899",
  refactor: "#f97316",
  docs: "#84cc16",
  test: "#14b8a6",
  chore: "#6b7280",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTaskCard(task: Task): string {
  const statusColor = STATUS_COLORS[task.status] || "#6b7280";
  const typeColor = task.task_type ? TYPE_COLORS[task.task_type] || "#6b7280" : null;

  return `
    <div class="task-card" data-status="${task.status}">
      <div class="task-header">
        <span class="status-badge" style="background: ${statusColor}">${task.status}</span>
        ${task.priority ? `<span class="priority-badge">${task.priority.toUpperCase()}</span>` : ""}
        ${task.task_type ? `<span class="type-badge" style="background: ${typeColor}">${task.task_type}</span>` : ""}
      </div>
      <h3 class="task-title">${escapeHtml(task.title)}</h3>
      ${task.description ? `<p class="task-desc">${escapeHtml(task.description.slice(0, 150))}${task.description.length > 150 ? "..." : ""}</p>` : ""}
      <div class="task-meta">
        <span class="task-id">${task.id.slice(0, 8)}</span>
        ${task.assignee ? `<span class="task-assignee">${escapeHtml(task.assignee)}</span>` : ""}
      </div>
    </div>
  `;
}

function generateHtml(tasks: Task[], projects: Project[], selectedProjectId?: string): string {
  const pending = tasks.filter(t => t.status === "pending");
  const inProgress = tasks.filter(t => t.status === "in_progress");
  const blocked = tasks.filter(t => t.status === "blocked");
  const completed = tasks.filter(t => t.status === "completed");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claudia - Task Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      min-height: 100vh;
      padding: 2rem;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #262626;
    }
    .logo {
      width: 40px;
      height: 40px;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .stats {
      margin-left: auto;
      display: flex;
      gap: 1.5rem;
      font-size: 0.875rem;
      color: #a3a3a3;
    }
    .stat { display: flex; align-items: center; gap: 0.5rem; }
    .stat-dot { width: 8px; height: 8px; border-radius: 50%; }
    .board {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
      min-height: calc(100vh - 120px);
    }
    .column {
      background: #111;
      border-radius: 12px;
      padding: 1rem;
      border: 1px solid #262626;
    }
    .column-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #262626;
    }
    .column-title {
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .column-count {
      background: #262626;
      padding: 0.125rem 0.5rem;
      border-radius: 10px;
      font-size: 0.75rem;
      color: #a3a3a3;
    }
    .task-card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      transition: all 0.2s;
    }
    .task-card:hover {
      border-color: #ff3399;
      transform: translateY(-2px);
    }
    .task-header {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }
    .status-badge, .type-badge {
      font-size: 0.625rem;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
      color: #fff;
    }
    .priority-badge {
      font-size: 0.625rem;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      background: #ff3399;
      color: #000;
      font-weight: 700;
    }
    .task-title {
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }
    .task-desc {
      font-size: 0.75rem;
      color: #a3a3a3;
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    .task-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.625rem;
      color: #737373;
    }
    .task-id { font-family: monospace; }
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #525252;
      font-size: 0.875rem;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: 1rem;
    }
    .project-select {
      background: #171717;
      border: 1px solid #262626;
      color: #fafafa;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .project-select:hover {
      border-color: #ff3399;
    }
    .project-select:focus {
      outline: none;
      border-color: #ff3399;
    }
    .clear-btn {
      background: #262626;
      border: 1px solid #404040;
      color: #a3a3a3;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .clear-btn:hover {
      background: #ef4444;
      border-color: #ef4444;
      color: #fff;
    }
    .clear-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    @media (max-width: 1024px) {
      .board { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .board { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <svg class="logo" viewBox="0 0 32 32" fill="none">
      <path d="M16 4C16 4 18 8 18 10C18 12 16 14 16 14C16 14 14 12 14 10C14 8 16 4 16 4Z" fill="#ff3399"/>
      <path d="M16 28C16 28 18 24 18 22C18 20 16 18 16 18C16 18 14 20 14 22C14 24 16 28 16 28Z" fill="#ff3399"/>
      <path d="M4 16C4 16 8 14 10 14C12 14 14 16 14 16C14 16 12 18 10 18C8 18 4 16 4 16Z" fill="#ff3399"/>
      <path d="M28 16C28 16 24 14 22 14C20 14 18 16 18 16C18 16 20 18 22 18C24 18 28 16 28 16Z" fill="#ff3399"/>
      <path d="M7 7C7 7 10 9 11 10.5C12 12 12 14 12 14C12 14 10 13 8.5 12C7 11 5 8 7 7Z" fill="#ff66b2"/>
      <path d="M25 7C25 7 22 9 21 10.5C20 12 20 14 20 14C20 14 22 13 23.5 12C25 11 27 8 25 7Z" fill="#ff66b2"/>
      <path d="M7 25C7 25 10 23 11 21.5C12 20 12 18 12 18C12 18 10 19 8.5 20C7 21 5 24 7 25Z" fill="#ff66b2"/>
      <path d="M25 25C25 25 22 23 21 21.5C20 20 20 18 20 18C20 18 22 19 23.5 20C25 21 27 24 25 25Z" fill="#ff66b2"/>
      <circle cx="16" cy="16" r="4" fill="#ffcc00"/>
    </svg>
    <h1>Claudia</h1>
    <div class="header-controls">
      <select class="project-select" onchange="window.location.href='/?project=' + this.value">
        <option value="">All Projects</option>
        ${projects.map(p => `<option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
      ${completed.length > 0 ? `<button class="clear-btn" onclick="clearCompleted()">Clear ${completed.length} Completed</button>` : ''}
    </div>
    <div class="stats">
      <div class="stat">
        <span class="stat-dot" style="background: #fbbf24"></span>
        <span>${pending.length} Pending</span>
      </div>
      <div class="stat">
        <span class="stat-dot" style="background: #3b82f6"></span>
        <span>${inProgress.length} In Progress</span>
      </div>
      <div class="stat">
        <span class="stat-dot" style="background: #ef4444"></span>
        <span>${blocked.length} Blocked</span>
      </div>
      <div class="stat">
        <span class="stat-dot" style="background: #22c55e"></span>
        <span>${completed.length} Completed</span>
      </div>
    </div>
  </div>

  <div class="board">
    <div class="column">
      <div class="column-header">
        <span class="stat-dot" style="background: #fbbf24"></span>
        <span class="column-title">Pending</span>
        <span class="column-count">${pending.length}</span>
      </div>
      ${pending.length ? pending.map(renderTaskCard).join("") : '<div class="empty-state">No pending tasks</div>'}
    </div>

    <div class="column">
      <div class="column-header">
        <span class="stat-dot" style="background: #3b82f6"></span>
        <span class="column-title">In Progress</span>
        <span class="column-count">${inProgress.length}</span>
      </div>
      ${inProgress.length ? inProgress.map(renderTaskCard).join("") : '<div class="empty-state">No tasks in progress</div>'}
    </div>

    <div class="column">
      <div class="column-header">
        <span class="stat-dot" style="background: #ef4444"></span>
        <span class="column-title">Blocked</span>
        <span class="column-count">${blocked.length}</span>
      </div>
      ${blocked.length ? blocked.map(renderTaskCard).join("") : '<div class="empty-state">No blocked tasks</div>'}
    </div>

    <div class="column">
      <div class="column-header">
        <span class="stat-dot" style="background: #22c55e"></span>
        <span class="column-title">Completed</span>
        <span class="column-count">${completed.length}</span>
      </div>
      ${completed.length ? completed.map(renderTaskCard).join("") : '<div class="empty-state">No completed tasks</div>'}
    </div>
  </div>

  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);

    async function clearCompleted() {
      if (!confirm('Archive all completed tasks? This cannot be undone.')) return;
      const btn = document.querySelector('.clear-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Clearing...';
      }
      try {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('project') || '';
        await fetch('/api/clear-completed?project=' + projectId, { method: 'POST' });
        location.reload();
      } catch (e) {
        alert('Failed to clear completed tasks');
        if (btn) btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

export async function startWebServer(port: number = 3333): Promise<void> {
  // Auto-detect current project from cwd
  const currentProject = projectService.getCurrentProject();
  const defaultProjectId = currentProject?.id;

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      // Use project from URL, or default to current project (not "all")
      const projectParam = url.searchParams.get("project");
      const projectId = projectParam !== null ? (projectParam || undefined) : defaultProjectId;

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const projects = projectService.listProjects();
        const query: { include_archived: boolean; project_id?: string } = { include_archived: false };
        if (projectId) {
          query.project_id = projectId;
        }
        const freshTasks = taskService.listTasks(query);
        return new Response(generateHtml(freshTasks, projects, projectId), {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/api/tasks") {
        const query: { include_archived: boolean; project_id?: string } = { include_archived: false };
        if (projectId) {
          query.project_id = projectId;
        }
        const freshTasks = taskService.listTasks(query);
        return new Response(JSON.stringify(freshTasks), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/projects") {
        const projects = projectService.listProjects();
        return new Response(JSON.stringify(projects), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/clear-completed" && req.method === "POST") {
        const clearProjectParam = url.searchParams.get("project");
        const clearProjectId = clearProjectParam || undefined;
        const query: { status: ["completed"]; project_id?: string } = { status: ["completed"] };
        if (clearProjectId) {
          query.project_id = clearProjectId;
        }
        const completedTasks = taskService.listTasks(query);
        let archived = 0;
        for (const task of completedTasks) {
          try {
            taskService.transitionTask(task.id, "archived");
            archived++;
          } catch {
            // Skip tasks that can't be archived
          }
        }
        return new Response(JSON.stringify({ archived, total: completedTasks.length }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  const url = `http://localhost:${port}`;
  console.log(`Dashboard running at ${url}`);

  // Open browser using shell
  const { execSync } = await import("child_process");
  try {
    if (process.platform === "darwin") {
      execSync(`open "${url}"`);
    } else if (process.platform === "win32") {
      execSync(`start "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch (e) {
    console.log(`Open ${url} in your browser`);
  }

  // Keep server running
  await new Promise(() => {});
}
