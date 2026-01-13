import type { Task } from "../schemas/task.js";
import type { Sprint } from "../schemas/sprint.js";

// ANSI color codes
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

const c = COLORS;

// Status colors
const STATUS_COLORS: Record<string, string> = {
  pending: c.white,
  in_progress: c.brightCyan,
  blocked: c.brightRed,
  completed: c.brightGreen,
  archived: c.brightBlack,
};

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  p0: c.brightRed,
  p1: c.brightYellow,
  p2: c.brightBlue,
  p3: c.brightBlack,
};

// Task type colors
const TYPE_COLORS: Record<string, string> = {
  feature: c.brightGreen,
  bugfix: c.brightRed,
  planning: c.brightMagenta,
  development: c.brightCyan,
  ui: c.brightYellow,
  refactor: c.brightBlue,
  docs: c.white,
  test: c.brightMagenta,
  chore: c.brightBlack,
};

// Task type short codes
const TYPE_CODES: Record<string, string> = {
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

/**
 * Format colored progress bar like htop
 */
export function formatProgressBar(completed: number, total: number, width = 20, label = ""): string {
  if (total === 0) {
    return `${label}[${c.brightBlack}${".".repeat(width)}${c.reset}]`;
  }

  const percent = (completed / total) * 100;
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;

  // Color gradient based on percentage
  let barColor = c.green;
  if (percent > 80) barColor = c.brightGreen;
  else if (percent > 50) barColor = c.green;
  else if (percent > 25) barColor = c.yellow;
  else barColor = c.red;

  const bar = `${barColor}${"|".repeat(filled)}${c.brightBlack}${".".repeat(empty)}${c.reset}`;
  const stats = `${c.brightWhite}${completed}${c.reset}/${c.brightCyan}${total}${c.reset}`;

  return `${label}[${bar}${c.reset}]${stats}`;
}

/**
 * Format a single task line with colors
 */
export function formatTaskLine(task: Task, indent = 0): string {
  const statusColor = STATUS_COLORS[task.status] || c.white;
  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : c.brightBlack;
  const typeColor = task.task_type ? TYPE_COLORS[task.task_type] : c.brightBlack;

  const prefix = "  ".repeat(indent);
  const idShort = task.id.slice(0, 8);

  const status = task.status.slice(0, 4).toUpperCase().padEnd(4);
  const priority = task.priority ? task.priority.toUpperCase() : "   ";
  const type = task.task_type ? TYPE_CODES[task.task_type] : "   ";

  return `${prefix}${statusColor}${status}${c.reset} ${priorityColor}${priority}${c.reset} ${typeColor}${type}${c.reset} ${task.title} ${c.brightBlack}(${idShort})${c.reset}`;
}

/**
 * Format task table like htop process list
 */
export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return `${c.brightBlack}  No tasks found${c.reset}`;
  }

  const lines: string[] = [];

  // Header row with background color (htop style)
  const header = `${c.bgGreen}${c.black}  ID       STATUS      PRI  TYPE TITLE                                    ${c.reset}`;
  lines.push(header);

  // Tasks
  for (const task of tasks) {
    const statusColor = STATUS_COLORS[task.status] || c.white;
    const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : c.brightBlack;
    const typeColor = task.task_type ? TYPE_COLORS[task.task_type] : c.brightBlack;

    const id = task.id.slice(0, 8);
    const status = task.status.padEnd(11);
    const priority = (task.priority || "   ").padEnd(4);
    const type = (task.task_type ? TYPE_CODES[task.task_type] : "   ").padEnd(4);
    const title = task.title.length > 40 ? task.title.slice(0, 37) + "..." : task.title.padEnd(40);

    lines.push(`  ${c.cyan}${id}${c.reset} ${statusColor}${status}${c.reset} ${priorityColor}${priority}${c.reset} ${typeColor}${type}${c.reset} ${title}`);
  }

  lines.push("");
  lines.push(`${c.brightBlack}  Total: ${tasks.length} tasks${c.reset}`);

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

    const statusColor = STATUS_COLORS[task.status] || c.white;
    const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : c.brightBlack;

    const status = task.status.slice(0, 4).toUpperCase();
    const priority = task.priority || "  ";

    lines.push(
      `${c.brightBlack}${"    ".repeat(Math.max(0, indent - 1))}${prefix}${c.reset}` +
      `${statusColor}${status}${c.reset} ${priorityColor}${priority}${c.reset} ${task.title}`
    );

    // Recursively add children
    const childLines = formatTaskTree(tasks, task.id, indent + 1);
    if (childLines) {
      lines.push(...childLines.split("\n").map(l =>
        `${c.brightBlack}${"    ".repeat(Math.max(0, indent - 1))}${continuePrefix}${c.reset}${l}`
      ));
    }
  }

  return lines.join("\n");
}

/**
 * Format sprint card with htop-style meters
 */
export function formatSprintCard(sprint: Sprint & { tasks?: Task[]; task_counts?: Record<string, number> }): string {
  const lines: string[] = [];

  // Sprint header
  const statusColor = sprint.status === "active" ? c.brightGreen :
                      sprint.status === "completed" ? c.brightBlue : c.white;

  lines.push(`${c.bold}${c.bgBlue}${c.white} SPRINT: ${sprint.name} ${c.reset}`);
  lines.push(`  Status: ${statusColor}${sprint.status}${c.reset}`);

  if (sprint.start_at || sprint.end_at) {
    lines.push(`  ${c.brightBlack}${sprint.start_at?.slice(0, 10) || "?"} -> ${sprint.end_at?.slice(0, 10) || "?"}${c.reset}`);
  }

  // Task progress meters (htop style)
  if (sprint.task_counts) {
    const total = Object.values(sprint.task_counts).reduce((a, b) => a + b, 0);
    const completed = sprint.task_counts.completed || 0;
    const inProgress = sprint.task_counts.in_progress || 0;
    const blocked = sprint.task_counts.blocked || 0;
    const pending = sprint.task_counts.pending || 0;

    lines.push("");
    lines.push(`  ${formatProgressBar(completed, total, 30, `${c.brightWhite}Done ${c.reset}`)}`);

    // Status breakdown with mini bars
    lines.push(`  ${c.brightGreen}+${c.reset} completed   [${c.brightGreen}${"|".repeat(Math.min(15, completed))}${c.reset}] ${completed}`);
    lines.push(`  ${c.brightCyan}>${c.reset} in_progress [${c.brightCyan}${"|".repeat(Math.min(15, inProgress))}${c.reset}] ${inProgress}`);
    lines.push(`  ${c.brightRed}x${c.reset} blocked     [${c.brightRed}${"|".repeat(Math.min(15, blocked))}${c.reset}] ${blocked}`);
    lines.push(`  ${c.white}o${c.reset} pending     [${c.white}${"|".repeat(Math.min(15, pending))}${c.reset}] ${pending}`);
  }

  return lines.join("\n");
}

/**
 * Format sprint list
 */
export function formatSprintList(sprints: Array<Sprint & { task_counts?: Record<string, number> }>): string {
  if (sprints.length === 0) {
    return `${c.brightBlack}  No sprints found${c.reset}`;
  }

  const lines: string[] = [];

  // Header
  lines.push(`${c.bgGreen}${c.black} ST  NAME                     STATUS      PROGRESS              ${c.reset}`);

  for (const sprint of sprints) {
    const statusColor = sprint.status === "active" ? c.brightGreen :
                        sprint.status === "completed" ? c.brightBlue : c.white;

    const name = sprint.name.length > 23 ? sprint.name.slice(0, 20) + "..." : sprint.name.padEnd(23);
    const status = sprint.status.padEnd(11);

    let progress = "";
    if (sprint.task_counts) {
      const total = Object.values(sprint.task_counts).reduce((a, b) => a + b, 0);
      const completed = sprint.task_counts.completed || 0;
      const filled = total > 0 ? Math.round((completed / total) * 15) : 0;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      progress = `${c.green}${"|".repeat(filled)}${c.brightBlack}${".".repeat(15 - filled)}${c.reset} ${percent}%`;
    }

    const marker = sprint.status === "active" ? `${c.brightGreen}*${c.reset}` : " ";
    lines.push(` ${marker}  ${name} ${statusColor}${status}${c.reset} ${progress}`);
  }

  return lines.join("\n");
}

/**
 * Format project summary like htop header
 */
export function formatProjectSummary(
  projectName: string,
  tasks: Task[],
  sprints: Array<Sprint & { task_counts?: Record<string, number> }>
): string {
  const lines: string[] = [];

  // Count tasks by status
  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = tasks.length;
  const completed = statusCounts.completed || 0;
  const inProgress = statusCounts.in_progress || 0;
  const blocked = statusCounts.blocked || 0;
  const pending = statusCounts.pending || 0;

  // Header like htop
  lines.push(`${c.bold}${c.bgBlue}${c.white} ${projectName} ${c.reset}`);
  lines.push("");

  // CPU-style task meters
  lines.push(`  ${c.brightWhite}Tasks:${c.reset} ${total}   ${c.brightGreen}+${completed}${c.reset} ${c.brightCyan}>${inProgress}${c.reset} ${c.brightRed}x${blocked}${c.reset} ${c.white}o${pending}${c.reset}`);
  lines.push("");

  // Progress bars for each status (htop meter style)
  const barWidth = 25;

  const completedBar = Math.round((completed / Math.max(total, 1)) * barWidth);
  const inProgressBar = Math.round((inProgress / Math.max(total, 1)) * barWidth);
  const blockedBar = Math.round((blocked / Math.max(total, 1)) * barWidth);
  const pendingBar = Math.round((pending / Math.max(total, 1)) * barWidth);

  lines.push(`  1  [${c.brightGreen}${"|".repeat(completedBar)}${c.brightBlack}${".".repeat(barWidth - completedBar)}${c.reset}] ${c.brightGreen}${Math.round((completed / Math.max(total, 1)) * 100)}%${c.reset}  completed`);
  lines.push(`  2  [${c.brightCyan}${"|".repeat(inProgressBar)}${c.brightBlack}${".".repeat(barWidth - inProgressBar)}${c.reset}] ${c.brightCyan}${Math.round((inProgress / Math.max(total, 1)) * 100)}%${c.reset}  in_progress`);
  lines.push(`  3  [${c.brightRed}${"|".repeat(blockedBar)}${c.brightBlack}${".".repeat(barWidth - blockedBar)}${c.reset}] ${c.brightRed}${Math.round((blocked / Math.max(total, 1)) * 100)}%${c.reset}  blocked`);
  lines.push(`  4  [${c.white}${"|".repeat(pendingBar)}${c.brightBlack}${".".repeat(barWidth - pendingBar)}${c.reset}] ${c.white}${Math.round((pending / Math.max(total, 1)) * 100)}%${c.reset}  pending`);

  // Overall progress meter
  lines.push("");
  lines.push(`  ${formatProgressBar(completed, total, 30, `${c.brightWhite}Done ${c.reset}`)}`);

  // Task type breakdown
  const typeCounts = tasks.reduce((acc, t) => {
    if (t.task_type) {
      acc[t.task_type] = (acc[t.task_type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (Object.keys(typeCounts).length > 0) {
    lines.push("");
    lines.push(`  ${c.bold}By Type:${c.reset}`);
    for (const [type, count] of Object.entries(typeCounts)) {
      const typeColor = TYPE_COLORS[type] || c.white;
      const code = TYPE_CODES[type] || "???";
      lines.push(`    ${typeColor}${code}${c.reset} ${type.padEnd(12)} ${count}`);
    }
  }

  // Active sprint
  const activeSprint = sprints.find(s => s.status === "active");
  if (activeSprint) {
    lines.push("");
    lines.push(`  ${c.bold}Active Sprint:${c.reset} ${c.brightGreen}${activeSprint.name}${c.reset}`);
  }

  return lines.join("\n");
}

/**
 * Format task detail card
 */
export function formatTaskCard(task: Task): string {
  const lines: string[] = [];

  const statusColor = STATUS_COLORS[task.status] || c.white;
  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : c.brightBlack;
  const typeColor = task.task_type ? TYPE_COLORS[task.task_type] : c.brightBlack;

  // Header
  lines.push(`${c.bgBlue}${c.white}${c.bold} TASK: ${task.title.slice(0, 50)} ${c.reset}`);
  lines.push("");

  // ID
  lines.push(`  ${c.brightBlack}ID:${c.reset}       ${c.cyan}${task.id}${c.reset}`);

  // Status and Priority on same line
  lines.push(`  ${c.brightBlack}Status:${c.reset}   ${statusColor}${task.status}${c.reset}    ${c.brightBlack}Priority:${c.reset} ${priorityColor}${task.priority || "none"}${c.reset}`);

  // Type
  if (task.task_type) {
    lines.push(`  ${c.brightBlack}Type:${c.reset}     ${typeColor}${TYPE_CODES[task.task_type]} ${task.task_type}${c.reset}`);
  }

  // Description
  if (task.description) {
    lines.push("");
    lines.push(`  ${c.brightBlack}Description:${c.reset}`);
    const descLines = task.description.split("\n");
    for (const line of descLines.slice(0, 5)) {
      lines.push(`    ${line.slice(0, 70)}`);
    }
    if (descLines.length > 5) {
      lines.push(`    ${c.brightBlack}... (${descLines.length - 5} more lines)${c.reset}`);
    }
  }

  // Metadata
  lines.push("");
  if (task.assignee) {
    lines.push(`  ${c.brightBlack}Assignee:${c.reset} ${c.brightYellow}${task.assignee}${c.reset}`);
  }
  if (task.due_at) {
    lines.push(`  ${c.brightBlack}Due:${c.reset}      ${c.brightRed}${task.due_at.slice(0, 10)}${c.reset}`);
  }
  if (task.tags && task.tags.length > 0) {
    lines.push(`  ${c.brightBlack}Tags:${c.reset}     ${c.brightMagenta}${task.tags.join(", ")}${c.reset}`);
  }
  if (task.images && task.images.length > 0) {
    lines.push(`  ${c.brightBlack}Images:${c.reset}   ${task.images.length} attached`);
  }

  lines.push("");
  lines.push(`  ${c.brightBlack}Created:${c.reset}  ${task.created_at.slice(0, 10)}    ${c.brightBlack}Version:${c.reset} ${task.version}`);

  return lines.join("\n");
}

/**
 * Format kanban board with colors
 */
export function formatKanbanBoard(tasks: Task[]): string {
  const columns = ["pending", "in_progress", "blocked", "completed"];
  const colWidth = 24;
  const lines: string[] = [];

  // Group tasks by status
  const byStatus = columns.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  // Header with colored backgrounds
  const headers = columns.map(status => {
    const color = status === "pending" ? `${c.bgWhite}${c.black}` :
                  status === "in_progress" ? `${c.bgCyan}${c.black}` :
                  status === "blocked" ? `${c.bgRed}${c.white}` :
                  `${c.bgGreen}${c.black}`;
    const count = byStatus[status].length;
    return `${color} ${status.slice(0, 10).toUpperCase().padEnd(10)} (${count}) ${c.reset}`;
  });
  lines.push(headers.join(" "));
  lines.push("");

  // Find max rows needed
  const maxRows = Math.max(...Object.values(byStatus).map(t => t.length), 1);

  // Tasks
  for (let i = 0; i < Math.min(maxRows, 12); i++) {
    const row = columns.map(status => {
      const task = byStatus[status][i];
      if (!task) return " ".repeat(colWidth);

      const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : c.brightBlack;
      const pri = task.priority ? task.priority.slice(1) : " ";
      const title = task.title.length > colWidth - 4
        ? task.title.slice(0, colWidth - 7) + "..."
        : task.title.padEnd(colWidth - 4);
      return `${priorityColor}${pri}${c.reset} ${title}`;
    });
    lines.push(row.join(" "));
  }

  if (maxRows > 12) {
    const overflow = columns.map(status => {
      const remaining = byStatus[status].length - 12;
      return remaining > 0
        ? `${c.brightBlack}  +${remaining} more${c.reset}`.padEnd(colWidth + 10)
        : " ".repeat(colWidth);
    });
    lines.push(overflow.join(" "));
  }

  return lines.join("\n");
}

/**
 * Legend with colors
 */
export function formatLegend(): string {
  const lines: string[] = [];

  lines.push(`${c.bgBlue}${c.white}${c.bold} LEGEND ${c.reset}`);
  lines.push("");
  lines.push(`  ${c.bold}STATUS:${c.reset}`);
  lines.push(`    ${c.white}o${c.reset} pending      ${c.brightCyan}>${c.reset} in_progress`);
  lines.push(`    ${c.brightRed}x${c.reset} blocked      ${c.brightGreen}+${c.reset} completed`);
  lines.push(`    ${c.brightBlack}-${c.reset} archived`);
  lines.push("");
  lines.push(`  ${c.bold}PRIORITY:${c.reset}`);
  lines.push(`    ${c.brightRed}p0${c.reset} critical    ${c.brightYellow}p1${c.reset} high`);
  lines.push(`    ${c.brightBlue}p2${c.reset} medium      ${c.brightBlack}p3${c.reset} low`);
  lines.push("");
  lines.push(`  ${c.bold}TYPES:${c.reset}`);
  lines.push(`    ${c.brightGreen}FEA${c.reset} feature     ${c.brightRed}BUG${c.reset} bugfix      ${c.brightMagenta}PLN${c.reset} planning`);
  lines.push(`    ${c.brightCyan}DEV${c.reset} development ${c.brightYellow}UI ${c.reset} ui          ${c.brightBlue}REF${c.reset} refactor`);
  lines.push(`    ${c.white}DOC${c.reset} docs        ${c.brightMagenta}TST${c.reset} test        ${c.brightBlack}CHR${c.reset} chore`);
  lines.push("");
  lines.push(`  ${c.bold}PROGRESS BAR:${c.reset}`);
  lines.push(`    [${c.green}||||||||||${c.brightBlack}..........${c.reset}]${c.brightWhite}5${c.reset}/${c.brightCyan}10${c.reset}`);

  return lines.join("\n");
}
