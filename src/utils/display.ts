import type { Task } from "../schemas/task.js";
import type { Sprint } from "../schemas/sprint.js";

// Status icons
const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  in_progress: "◐",
  blocked: "⊘",
  completed: "●",
  archived: "◌",
};

// Priority colors/indicators
const PRIORITY_INDICATORS: Record<string, string> = {
  p0: "🔴",
  p1: "🟠",
  p2: "🟡",
  p3: "🟢",
};

// Task type indicators
const TYPE_INDICATORS: Record<string, string> = {
  feature: "✨",
  bugfix: "🐛",
  planning: "📋",
  development: "💻",
  ui: "🎨",
  refactor: "♻️",
  docs: "📝",
  test: "🧪",
  chore: "🔧",
};

// Sprint status
const SPRINT_STATUS_ICONS: Record<string, string> = {
  planning: "📝",
  active: "▶️",
  completed: "✅",
  archived: "📦",
};

/**
 * Format a single task as a CLI line
 */
export function formatTaskLine(task: Task, indent = 0): string {
  const status = STATUS_ICONS[task.status] || "?";
  const priority = task.priority ? PRIORITY_INDICATORS[task.priority] || "" : "  ";
  const type = task.task_type ? TYPE_INDICATORS[task.task_type] || "" : "";
  const prefix = "  ".repeat(indent);
  const idShort = task.id.slice(0, 8);

  return `${prefix}${status} ${priority} ${type} ${task.title} (${idShort})`;
}

/**
 * Format task list as a table
 */
export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "┌─────────────────────────────────────────┐\n│           No tasks found                │\n└─────────────────────────────────────────┘";
  }

  const lines: string[] = [];
  const maxTitleLen = Math.min(40, Math.max(...tasks.map(t => t.title.length)));
  const width = maxTitleLen + 30;

  // Header
  lines.push("┌" + "─".repeat(width) + "┐");
  lines.push("│ " + "Status".padEnd(8) + "Pri".padEnd(4) + "Type".padEnd(5) + "Title".padEnd(maxTitleLen + 2) + "ID".padEnd(10) + "│");
  lines.push("├" + "─".repeat(width) + "┤");

  // Tasks
  for (const task of tasks) {
    const status = STATUS_ICONS[task.status] || "?";
    const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "  ";
    const type = task.task_type ? TYPE_INDICATORS[task.task_type] : "  ";
    const title = task.title.length > maxTitleLen
      ? task.title.slice(0, maxTitleLen - 3) + "..."
      : task.title.padEnd(maxTitleLen);
    const idShort = task.id.slice(0, 8);

    lines.push(`│ ${status.padEnd(7)} ${priority.padEnd(3)} ${type.padEnd(4)} ${title}  ${idShort} │`);
  }

  // Footer
  lines.push("└" + "─".repeat(width) + "┘");
  lines.push(`  Total: ${tasks.length} tasks`);

  return lines.join("\n");
}

/**
 * Format task tree with visual hierarchy
 */
export function formatTaskTree(tasks: Task[], parentId?: string, indent = 0): string {
  const lines: string[] = [];
  const rootTasks = tasks.filter(t => t.parent_id === parentId);

  for (let i = 0; i < rootTasks.length; i++) {
    const task = rootTasks[i];
    const isLast = i === rootTasks.length - 1;
    const prefix = indent === 0 ? "" : (isLast ? "└── " : "├── ");
    const continuePrefix = indent === 0 ? "" : (isLast ? "    " : "│   ");

    const status = STATUS_ICONS[task.status] || "?";
    const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "";
    const type = task.task_type ? TYPE_INDICATORS[task.task_type] : "";

    lines.push("  ".repeat(Math.max(0, indent - 1)) + prefix + `${status} ${priority} ${type} ${task.title}`);

    // Recursively add children
    const childLines = formatTaskTree(tasks, task.id, indent + 1);
    if (childLines) {
      lines.push(...childLines.split("\n").map(l => "  ".repeat(Math.max(0, indent - 1)) + continuePrefix + l));
    }
  }

  return lines.join("\n");
}

/**
 * Format progress bar
 */
export function formatProgressBar(completed: number, total: number, width = 30): string {
  if (total === 0) return `[${"░".repeat(width)}] 0%`;

  const percent = Math.round((completed / total) * 100);
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;

  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percent}% (${completed}/${total})`;
}

/**
 * Format sprint card
 */
export function formatSprintCard(sprint: Sprint & { tasks?: Task[]; task_counts?: Record<string, number> }): string {
  const lines: string[] = [];
  const width = 50;
  const statusIcon = SPRINT_STATUS_ICONS[sprint.status] || "?";

  lines.push("╔" + "═".repeat(width) + "╗");
  lines.push("║ " + `${statusIcon} ${sprint.name}`.padEnd(width - 1) + "║");
  lines.push("╠" + "═".repeat(width) + "╣");

  // Status
  lines.push("║ " + `Status: ${sprint.status}`.padEnd(width - 1) + "║");

  // Dates
  if (sprint.start_at || sprint.end_at) {
    const dateStr = `${sprint.start_at?.slice(0, 10) || "?"} → ${sprint.end_at?.slice(0, 10) || "?"}`;
    lines.push("║ " + `Dates: ${dateStr}`.padEnd(width - 1) + "║");
  }

  // Task counts if available
  if (sprint.task_counts) {
    lines.push("╟" + "─".repeat(width) + "╢");
    const total = Object.values(sprint.task_counts).reduce((a, b) => a + b, 0);
    const completed = sprint.task_counts.completed || 0;

    lines.push("║ " + `Tasks: ${total}`.padEnd(width - 1) + "║");
    lines.push("║ " + formatProgressBar(completed, total, width - 10).padEnd(width - 1) + "║");

    // Status breakdown
    const breakdown = Object.entries(sprint.task_counts)
      .map(([status, count]) => `${STATUS_ICONS[status] || status}: ${count}`)
      .join("  ");
    lines.push("║ " + breakdown.padEnd(width - 1) + "║");
  }

  lines.push("╚" + "═".repeat(width) + "╝");

  return lines.join("\n");
}

/**
 * Format sprint list
 */
export function formatSprintList(sprints: Array<Sprint & { task_counts?: Record<string, number> }>): string {
  if (sprints.length === 0) {
    return "┌─────────────────────────────────────────┐\n│           No sprints found              │\n└─────────────────────────────────────────┘";
  }

  const lines: string[] = [];
  const width = 60;

  lines.push("┌" + "─".repeat(width) + "┐");
  lines.push("│ " + "St".padEnd(3) + "Name".padEnd(25) + "Status".padEnd(12) + "Progress".padEnd(18) + "│");
  lines.push("├" + "─".repeat(width) + "┤");

  for (const sprint of sprints) {
    const statusIcon = SPRINT_STATUS_ICONS[sprint.status] || "?";
    const name = sprint.name.length > 23 ? sprint.name.slice(0, 20) + "..." : sprint.name.padEnd(23);

    let progress = "N/A";
    if (sprint.task_counts) {
      const total = Object.values(sprint.task_counts).reduce((a, b) => a + b, 0);
      const completed = sprint.task_counts.completed || 0;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      progress = `${percent}% (${completed}/${total})`;
    }

    lines.push(`│ ${statusIcon}  ${name} ${sprint.status.padEnd(11)} ${progress.padEnd(17)}│`);
  }

  lines.push("└" + "─".repeat(width) + "┘");

  return lines.join("\n");
}

/**
 * Format project summary with tasks and sprints
 */
export function formatProjectSummary(
  projectName: string,
  tasks: Task[],
  sprints: Array<Sprint & { task_counts?: Record<string, number> }>
): string {
  const lines: string[] = [];
  const width = 60;

  // Header
  lines.push("╔" + "═".repeat(width) + "╗");
  lines.push("║ " + `📁 ${projectName}`.padEnd(width - 1) + "║");
  lines.push("╚" + "═".repeat(width) + "╝");
  lines.push("");

  // Task summary by status
  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  lines.push("📊 Task Summary");
  lines.push("─".repeat(40));

  const total = tasks.length;
  const completed = statusCounts.completed || 0;
  lines.push(formatProgressBar(completed, total, 30));
  lines.push("");

  for (const [status, count] of Object.entries(statusCounts)) {
    const icon = STATUS_ICONS[status] || "?";
    const bar = "█".repeat(Math.round((count / total) * 20));
    lines.push(`  ${icon} ${status.padEnd(12)} ${bar} ${count}`);
  }

  // Task type breakdown
  const typeCounts = tasks.reduce((acc, t) => {
    if (t.task_type) {
      acc[t.task_type] = (acc[t.task_type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (Object.keys(typeCounts).length > 0) {
    lines.push("");
    lines.push("📋 By Type");
    lines.push("─".repeat(40));
    for (const [type, count] of Object.entries(typeCounts)) {
      const icon = TYPE_INDICATORS[type] || "?";
      lines.push(`  ${icon} ${type.padEnd(12)} ${count}`);
    }
  }

  // Active sprint
  const activeSprint = sprints.find(s => s.status === "active");
  if (activeSprint) {
    lines.push("");
    lines.push("🏃 Active Sprint");
    lines.push("─".repeat(40));
    lines.push(formatSprintCard(activeSprint));
  }

  return lines.join("\n");
}

/**
 * Format task detail card
 */
export function formatTaskCard(task: Task): string {
  const lines: string[] = [];
  const width = 55;

  const status = STATUS_ICONS[task.status] || "?";
  const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "";
  const type = task.task_type ? TYPE_INDICATORS[task.task_type] + " " + task.task_type : "";

  lines.push("╔" + "═".repeat(width) + "╗");
  lines.push("║ " + `${status} ${priority} ${task.title}`.slice(0, width - 2).padEnd(width - 1) + "║");
  lines.push("╠" + "═".repeat(width) + "╣");

  // ID
  lines.push("║ " + `ID: ${task.id}`.padEnd(width - 1) + "║");

  // Status & Priority
  lines.push("║ " + `Status: ${task.status}`.padEnd(25) + `Priority: ${task.priority || "none"}`.padEnd(width - 26) + "║");

  // Type
  if (type) {
    lines.push("║ " + `Type: ${type}`.padEnd(width - 1) + "║");
  }

  // Description
  if (task.description) {
    lines.push("╟" + "─".repeat(width) + "╢");
    const descLines = task.description.split("\n");
    for (const line of descLines.slice(0, 5)) {
      const truncated = line.length > width - 3 ? line.slice(0, width - 6) + "..." : line;
      lines.push("║ " + truncated.padEnd(width - 1) + "║");
    }
    if (descLines.length > 5) {
      lines.push("║ " + `... (${descLines.length - 5} more lines)`.padEnd(width - 1) + "║");
    }
  }

  // Metadata
  lines.push("╟" + "─".repeat(width) + "╢");
  if (task.assignee) {
    lines.push("║ " + `Assignee: ${task.assignee}`.padEnd(width - 1) + "║");
  }
  if (task.due_at) {
    lines.push("║ " + `Due: ${task.due_at.slice(0, 10)}`.padEnd(width - 1) + "║");
  }
  if (task.tags && task.tags.length > 0) {
    lines.push("║ " + `Tags: ${task.tags.join(", ")}`.slice(0, width - 2).padEnd(width - 1) + "║");
  }
  if (task.images && task.images.length > 0) {
    lines.push("║ " + `📷 ${task.images.length} image(s) attached`.padEnd(width - 1) + "║");
  }

  lines.push("╟" + "─".repeat(width) + "╢");
  lines.push("║ " + `Created: ${task.created_at.slice(0, 10)}`.padEnd(25) + `v${task.version}`.padEnd(width - 26) + "║");
  lines.push("╚" + "═".repeat(width) + "╝");

  return lines.join("\n");
}

/**
 * Format kanban-style board
 */
export function formatKanbanBoard(tasks: Task[]): string {
  const columns = ["pending", "in_progress", "blocked", "completed"];
  const colWidth = 25;
  const lines: string[] = [];

  // Group tasks by status
  const byStatus = columns.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  // Header
  lines.push("┌" + columns.map(() => "─".repeat(colWidth)).join("┬") + "┐");
  lines.push("│" + columns.map(s => {
    const icon = STATUS_ICONS[s];
    const count = byStatus[s].length;
    return ` ${icon} ${s} (${count})`.padEnd(colWidth);
  }).join("│") + "│");
  lines.push("├" + columns.map(() => "─".repeat(colWidth)).join("┼") + "┤");

  // Find max rows needed
  const maxRows = Math.max(...Object.values(byStatus).map(t => t.length), 1);

  // Tasks
  for (let i = 0; i < Math.min(maxRows, 10); i++) {
    const row = columns.map(status => {
      const task = byStatus[status][i];
      if (!task) return " ".repeat(colWidth);

      const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : " ";
      const title = task.title.length > colWidth - 5
        ? task.title.slice(0, colWidth - 8) + "..."
        : task.title;
      return ` ${priority} ${title}`.padEnd(colWidth);
    });
    lines.push("│" + row.join("│") + "│");
  }

  if (maxRows > 10) {
    lines.push("│" + columns.map(status => {
      const remaining = byStatus[status].length - 10;
      return remaining > 0 ? ` ... +${remaining} more`.padEnd(colWidth) : " ".repeat(colWidth);
    }).join("│") + "│");
  }

  lines.push("└" + columns.map(() => "─".repeat(colWidth)).join("┴") + "┘");

  return lines.join("\n");
}

/**
 * Legend for status and priority icons
 */
export function formatLegend(): string {
  const lines: string[] = [];

  lines.push("📖 Legend");
  lines.push("─".repeat(40));
  lines.push("");
  lines.push("Status:");
  lines.push("  ○ pending    ◐ in_progress    ⊘ blocked");
  lines.push("  ● completed  ◌ archived");
  lines.push("");
  lines.push("Priority:");
  lines.push("  🔴 p0 (critical)  🟠 p1 (high)");
  lines.push("  🟡 p2 (medium)    🟢 p3 (low)");
  lines.push("");
  lines.push("Types:");
  lines.push("  ✨ feature  🐛 bugfix   📋 planning  💻 development");
  lines.push("  🎨 ui       ♻️ refactor  📝 docs      🧪 test  🔧 chore");

  return lines.join("\n");
}
