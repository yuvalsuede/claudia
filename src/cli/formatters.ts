import { stringify as yamlStringify } from "yaml";
import type { Task } from "../schemas/task.js";
import type { TaskTreeNode } from "../core/task.js";

export type OutputFormat = "json" | "yaml" | "text";

export function formatOutput(data: unknown, format: OutputFormat = "json"): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yamlStringify(data);
    case "text":
      return formatAsText(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatAsText(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return "No tasks found.";
    }
    return data.map((item) => formatTaskAsText(item as Task)).join("\n\n");
  }

  if (isTask(data)) {
    return formatTaskAsText(data);
  }

  return String(data);
}

function isTask(data: unknown): data is Task {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "title" in data &&
    "status" in data
  );
}

function formatTaskAsText(task: Task): string {
  const lines: string[] = [];

  const statusIcon = getStatusIcon(task.status);
  const priorityBadge = task.priority ? ` [${task.priority.toUpperCase()}]` : "";

  lines.push(`${statusIcon} ${task.title}${priorityBadge}`);
  lines.push(`  ID: ${task.id}`);
  lines.push(`  Status: ${task.status}`);

  if (task.description) {
    const desc =
      task.description.length > 100
        ? task.description.slice(0, 100) + "..."
        : task.description;
    lines.push(`  Description: ${desc}`);
  }

  if (task.parent_id) {
    lines.push(`  Parent: ${task.parent_id}`);
  }

  if (task.assignee) {
    lines.push(`  Assignee: ${task.assignee}`);
  }

  if (task.due_at) {
    lines.push(`  Due: ${task.due_at}`);
  }

  if (task.tags && task.tags.length > 0) {
    lines.push(`  Tags: ${task.tags.join(", ")}`);
  }

  lines.push(`  Created: ${task.created_at}`);

  return lines.join("\n");
}

function getStatusIcon(status: Task["status"]): string {
  switch (status) {
    case "pending":
      return "○";
    case "in_progress":
      return "◐";
    case "blocked":
      return "⊘";
    case "completed":
      return "●";
    case "archived":
      return "◌";
    default:
      return "?";
  }
}

export function formatError(error: Error): string {
  return JSON.stringify(
    {
      error: {
        name: error.name,
        message: error.message,
      },
    },
    null,
    2
  );
}

export function formatTree(nodes: TaskTreeNode | TaskTreeNode[], format: OutputFormat = "json"): string {
  if (format === "json") {
    return JSON.stringify(nodes, null, 2);
  }
  if (format === "yaml") {
    return yamlStringify(nodes);
  }

  // Text format - render as ASCII tree
  const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
  if (nodeArray.length === 0) {
    return "No tasks found.";
  }
  return nodeArray.map(node => formatTreeNode(node, "", true)).join("\n");
}

function formatTreeNode(node: TaskTreeNode, prefix: string, isLast: boolean): string {
  const lines: string[] = [];
  const connector = isLast ? "└── " : "├── ";
  const statusIcon = getStatusIcon(node.status);
  const priorityBadge = node.priority ? ` [${node.priority.toUpperCase()}]` : "";

  lines.push(`${prefix}${connector}${statusIcon} ${node.title}${priorityBadge} (${node.id.slice(0, 8)})`);

  const childPrefix = prefix + (isLast ? "    " : "│   ");
  node.children.forEach((child, index) => {
    const isLastChild = index === node.children.length - 1;
    lines.push(formatTreeNode(child, childPrefix, isLastChild));
  });

  return lines.join("\n");
}
