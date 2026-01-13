import type { Task } from "../schemas/task.js";
import type { Sprint } from "../schemas/sprint.js";

// Status icons - ASCII style
const STATUS_ICONS: Record<string, string> = {
  pending: "[ ]",
  in_progress: "[>]",
  blocked: "[X]",
  completed: "[+]",
  archived: "[-]",
};

// Priority indicators - ASCII
const PRIORITY_INDICATORS: Record<string, string> = {
  p0: "!!!",
  p1: "!! ",
  p2: "!  ",
  p3: "   ",
};

// Task type indicators - short codes
const TYPE_INDICATORS: Record<string, string> = {
  feature: "FEA",
  bugfix: "BUG",
  planning: "PLN",
  development: "DEV",
  ui: "UI ",
  refactor: "REF",
  docs: "DOC",
  test: "TST",
  chore: "CHR",
};

// Sprint status - ASCII
const SPRINT_STATUS_ICONS: Record<string, string> = {
  planning: "[P]",
  active: "[*]",
  completed: "[+]",
  archived: "[-]",
};

/**
 * Format a single task as a CLI line
 */
export function formatTaskLine(task: Task, indent = 0): string {
  const status = STATUS_ICONS[task.status] || "[?]";
  const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "   ";
  const type = task.task_type ? TYPE_INDICATORS[task.task_type] : "   ";
  const prefix = "  ".repeat(indent);
  const idShort = task.id.slice(0, 8);

  return `${prefix}${status} ${priority} ${type} ${task.title} (${idShort})`;
}

/**
 * Format task list as a table
 */
export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return `
+-------------------------------------------+
|            NO TASKS FOUND                 |
+-------------------------------------------+`;
  }

  const lines: string[] = [];
  const maxTitleLen = Math.min(35, Math.max(20, ...tasks.map(t => t.title.length)));

  // Header
  lines.push("+" + "-".repeat(6) + "+" + "-".repeat(5) + "+" + "-".repeat(5) + "+" + "-".repeat(maxTitleLen + 2) + "+" + "-".repeat(10) + "+");
  lines.push("| STAT | PRI | TYP | " + "TITLE".padEnd(maxTitleLen) + " | ID       |");
  lines.push("+" + "-".repeat(6) + "+" + "-".repeat(5) + "+" + "-".repeat(5) + "+" + "-".repeat(maxTitleLen + 2) + "+" + "-".repeat(10) + "+");

  // Tasks
  for (const task of tasks) {
    const status = STATUS_ICONS[task.status] || "[?]";
    const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "   ";
    const type = task.task_type ? TYPE_INDICATORS[task.task_type] : "   ";
    const title = task.title.length > maxTitleLen
      ? task.title.slice(0, maxTitleLen - 3) + "..."
      : task.title.padEnd(maxTitleLen);
    const idShort = task.id.slice(0, 8);

    lines.push(`| ${status} | ${priority} | ${type} | ${title} | ${idShort} |`);
  }

  // Footer
  lines.push("+" + "-".repeat(6) + "+" + "-".repeat(5) + "+" + "-".repeat(5) + "+" + "-".repeat(maxTitleLen + 2) + "+" + "-".repeat(10) + "+");
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
    const prefix = indent === 0 ? "" : (isLast ? "`-- " : "|-- ");
    const continuePrefix = indent === 0 ? "" : (isLast ? "    " : "|   ");

    const status = STATUS_ICONS[task.status] || "[?]";
    const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "   ";
    const type = task.task_type ? TYPE_INDICATORS[task.task_type] : "   ";

    lines.push("    ".repeat(Math.max(0, indent - 1)) + prefix + `${status} ${priority} ${type} ${task.title}`);

    // Recursively add children
    const childLines = formatTaskTree(tasks, task.id, indent + 1);
    if (childLines) {
      lines.push(...childLines.split("\n").map(l => "    ".repeat(Math.max(0, indent - 1)) + continuePrefix + l));
    }
  }

  return lines.join("\n");
}

/**
 * Format progress bar - ASCII style with |
 */
export function formatProgressBar(completed: number, total: number, width = 30): string {
  if (total === 0) return `[${".".repeat(width)}] 0%`;

  const percent = Math.round((completed / total) * 100);
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;

  return `[${"|".repeat(filled)}${".".repeat(empty)}] ${percent}% (${completed}/${total})`;
}

/**
 * Format sprint card
 */
export function formatSprintCard(sprint: Sprint & { tasks?: Task[]; task_counts?: Record<string, number> }): string {
  const lines: string[] = [];
  const width = 50;
  const statusIcon = SPRINT_STATUS_ICONS[sprint.status] || "[?]";

  lines.push("+" + "=".repeat(width) + "+");
  lines.push("| " + `${statusIcon} ${sprint.name}`.padEnd(width - 1) + "|");
  lines.push("+" + "=".repeat(width) + "+");

  // Status
  lines.push("| " + `Status: ${sprint.status}`.padEnd(width - 1) + "|");

  // Dates
  if (sprint.start_at || sprint.end_at) {
    const dateStr = `${sprint.start_at?.slice(0, 10) || "?"} -> ${sprint.end_at?.slice(0, 10) || "?"}`;
    lines.push("| " + `Dates:  ${dateStr}`.padEnd(width - 1) + "|");
  }

  // Task counts if available
  if (sprint.task_counts) {
    lines.push("+" + "-".repeat(width) + "+");
    const total = Object.values(sprint.task_counts).reduce((a, b) => a + b, 0);
    const completed = sprint.task_counts.completed || 0;

    lines.push("| " + `Tasks:  ${total}`.padEnd(width - 1) + "|");
    lines.push("| " + formatProgressBar(completed, total, width - 12).padEnd(width - 1) + "|");

    // Status breakdown
    lines.push("| " + " ".repeat(width - 1) + "|");
    for (const [status, count] of Object.entries(sprint.task_counts)) {
      const icon = STATUS_ICONS[status] || "[?]";
      const bar = "|".repeat(Math.min(20, Math.round((count / total) * 20)));
      lines.push("| " + `  ${icon} ${status.padEnd(12)} ${bar.padEnd(20)} ${count}`.padEnd(width - 1) + "|");
    }
  }

  lines.push("+" + "=".repeat(width) + "+");

  return lines.join("\n");
}

/**
 * Format sprint list
 */
export function formatSprintList(sprints: Array<Sprint & { task_counts?: Record<string, number> }>): string {
  if (sprints.length === 0) {
    return `
+-------------------------------------------+
|           NO SPRINTS FOUND                |
+-------------------------------------------+`;
  }

  const lines: string[] = [];
  const width = 70;

  lines.push("+" + "-".repeat(5) + "+" + "-".repeat(25) + "+" + "-".repeat(12) + "+" + "-".repeat(24) + "+");
  lines.push("| ST  | " + "NAME".padEnd(23) + " | " + "STATUS".padEnd(10) + " | " + "PROGRESS".padEnd(22) + " |");
  lines.push("+" + "-".repeat(5) + "+" + "-".repeat(25) + "+" + "-".repeat(12) + "+" + "-".repeat(24) + "+");

  for (const sprint of sprints) {
    const statusIcon = SPRINT_STATUS_ICONS[sprint.status] || "[?]";
    const name = sprint.name.length > 23 ? sprint.name.slice(0, 20) + "..." : sprint.name.padEnd(23);

    let progress = "N/A";
    if (sprint.task_counts) {
      const total = Object.values(sprint.task_counts).reduce((a, b) => a + b, 0);
      const completed = sprint.task_counts.completed || 0;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const bar = "|".repeat(Math.round(percent / 10));
      progress = `${bar.padEnd(10)} ${percent}%`.padEnd(22);
    }

    lines.push(`| ${statusIcon} | ${name} | ${sprint.status.padEnd(10)} | ${progress} |`);
  }

  lines.push("+" + "-".repeat(5) + "+" + "-".repeat(25) + "+" + "-".repeat(12) + "+" + "-".repeat(24) + "+");

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
  const width = 50;

  // Header
  lines.push("+" + "=".repeat(width) + "+");
  lines.push("| " + `PROJECT: ${projectName}`.padEnd(width - 1) + "|");
  lines.push("+" + "=".repeat(width) + "+");
  lines.push("");

  // Task summary by status
  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  lines.push("TASK SUMMARY");
  lines.push("-".repeat(width));

  const total = tasks.length;
  const completed = statusCounts.completed || 0;
  lines.push(formatProgressBar(completed, total, 40));
  lines.push("");

  for (const [status, count] of Object.entries(statusCounts)) {
    const icon = STATUS_ICONS[status] || "[?]";
    const barLen = total > 0 ? Math.round((count / total) * 30) : 0;
    const bar = "|".repeat(barLen);
    lines.push(`  ${icon} ${status.padEnd(12)} ${bar.padEnd(30)} ${count}`);
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
    lines.push("BY TYPE");
    lines.push("-".repeat(width));
    for (const [type, count] of Object.entries(typeCounts)) {
      const icon = TYPE_INDICATORS[type] || "???";
      lines.push(`  ${icon} ${type.padEnd(12)} ${count}`);
    }
  }

  // Active sprint
  const activeSprint = sprints.find(s => s.status === "active");
  if (activeSprint) {
    lines.push("");
    lines.push("ACTIVE SPRINT");
    lines.push("-".repeat(width));
    lines.push(formatSprintCard(activeSprint));
  }

  return lines.join("\n");
}

/**
 * Format task detail card
 */
export function formatTaskCard(task: Task): string {
  const lines: string[] = [];
  const width = 60;

  const status = STATUS_ICONS[task.status] || "[?]";
  const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "   ";
  const type = task.task_type ? `${TYPE_INDICATORS[task.task_type]} ${task.task_type}` : "";

  lines.push("+" + "=".repeat(width) + "+");
  lines.push("| " + `${status} ${priority} ${task.title}`.slice(0, width - 2).padEnd(width - 1) + "|");
  lines.push("+" + "=".repeat(width) + "+");

  // ID
  lines.push("| " + `ID:       ${task.id}`.padEnd(width - 1) + "|");

  // Status & Priority
  lines.push("| " + `Status:   ${task.status}`.padEnd(28) + `Priority: ${task.priority || "none"}`.padEnd(width - 29) + "|");

  // Type
  if (type) {
    lines.push("| " + `Type:     ${type}`.padEnd(width - 1) + "|");
  }

  // Description
  if (task.description) {
    lines.push("+" + "-".repeat(width) + "+");
    const descLines = task.description.split("\n");
    for (const line of descLines.slice(0, 5)) {
      const truncated = line.length > width - 3 ? line.slice(0, width - 6) + "..." : line;
      lines.push("| " + truncated.padEnd(width - 1) + "|");
    }
    if (descLines.length > 5) {
      lines.push("| " + `... (${descLines.length - 5} more lines)`.padEnd(width - 1) + "|");
    }
  }

  // Metadata
  lines.push("+" + "-".repeat(width) + "+");
  if (task.assignee) {
    lines.push("| " + `Assignee: ${task.assignee}`.padEnd(width - 1) + "|");
  }
  if (task.due_at) {
    lines.push("| " + `Due:      ${task.due_at.slice(0, 10)}`.padEnd(width - 1) + "|");
  }
  if (task.tags && task.tags.length > 0) {
    lines.push("| " + `Tags:     ${task.tags.join(", ")}`.slice(0, width - 2).padEnd(width - 1) + "|");
  }
  if (task.images && task.images.length > 0) {
    lines.push("| " + `Images:   ${task.images.length} attached`.padEnd(width - 1) + "|");
  }

  lines.push("+" + "-".repeat(width) + "+");
  lines.push("| " + `Created:  ${task.created_at.slice(0, 10)}`.padEnd(28) + `Version: ${task.version}`.padEnd(width - 29) + "|");
  lines.push("+" + "=".repeat(width) + "+");

  return lines.join("\n");
}

/**
 * Format kanban-style board
 */
export function formatKanbanBoard(tasks: Task[]): string {
  const columns = ["pending", "in_progress", "blocked", "completed"];
  const colWidth = 22;
  const lines: string[] = [];

  // Group tasks by status
  const byStatus = columns.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  // Header
  lines.push("+" + columns.map(() => "-".repeat(colWidth)).join("+") + "+");
  lines.push("|" + columns.map(s => {
    const icon = STATUS_ICONS[s];
    const count = byStatus[s].length;
    return ` ${icon} ${s.slice(0, 10)} (${count})`.padEnd(colWidth);
  }).join("|") + "|");
  lines.push("+" + columns.map(() => "-".repeat(colWidth)).join("+") + "+");

  // Find max rows needed
  const maxRows = Math.max(...Object.values(byStatus).map(t => t.length), 1);

  // Tasks
  for (let i = 0; i < Math.min(maxRows, 10); i++) {
    const row = columns.map(status => {
      const task = byStatus[status][i];
      if (!task) return " ".repeat(colWidth);

      const priority = task.priority ? PRIORITY_INDICATORS[task.priority] : "   ";
      const title = task.title.length > colWidth - 6
        ? task.title.slice(0, colWidth - 9) + "..."
        : task.title;
      return ` ${priority} ${title}`.padEnd(colWidth);
    });
    lines.push("|" + row.join("|") + "|");
  }

  if (maxRows > 10) {
    lines.push("|" + columns.map(status => {
      const remaining = byStatus[status].length - 10;
      return remaining > 0 ? ` ... +${remaining} more`.padEnd(colWidth) : " ".repeat(colWidth);
    }).join("|") + "|");
  }

  lines.push("+" + columns.map(() => "-".repeat(colWidth)).join("+") + "+");

  return lines.join("\n");
}

/**
 * Legend for status and priority icons
 */
export function formatLegend(): string {
  const lines: string[] = [];

  lines.push("+==============================================+");
  lines.push("|                   LEGEND                     |");
  lines.push("+==============================================+");
  lines.push("|                                              |");
  lines.push("| STATUS:                                      |");
  lines.push("|   [ ] pending      [>] in_progress           |");
  lines.push("|   [X] blocked      [+] completed             |");
  lines.push("|   [-] archived                               |");
  lines.push("|                                              |");
  lines.push("| PRIORITY:                                    |");
  lines.push("|   !!! p0 (critical)   !!  p1 (high)          |");
  lines.push("|   !   p2 (medium)         p3 (low)           |");
  lines.push("|                                              |");
  lines.push("| TYPES:                                       |");
  lines.push("|   FEA feature    BUG bugfix    PLN planning  |");
  lines.push("|   DEV develop    UI  ui        REF refactor  |");
  lines.push("|   DOC docs       TST test      CHR chore     |");
  lines.push("|                                              |");
  lines.push("| PROGRESS BAR:                                |");
  lines.push("|   [||||||||||..........] 50% (5/10)          |");
  lines.push("|                                              |");
  lines.push("+==============================================+");

  return lines.join("\n");
}
