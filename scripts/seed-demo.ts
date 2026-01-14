#!/usr/bin/env bun
/**
 * Seed script to create demo project with sample data
 * Run with: bun run scripts/seed-demo.ts
 */

import * as projectService from "../src/core/project.js";
import * as sprintService from "../src/core/sprint.js";
import * as taskService from "../src/core/task.js";

console.log("Creating demo project...");

// Create or find demo project
let project = projectService.listProjects().find(p => p.name === "Demo Project");
if (!project) {
  project = projectService.createProject({
    name: "Demo Project",
    description: "Sample project demonstrating Claudia features",
    path: "/demo",
  });
  console.log(`Created project: ${project.id}`);
} else {
  console.log(`Using existing project: ${project.id}`);
}

projectService.selectProject(project.id);

// Create sprints
console.log("\nCreating sprints...");

const sprint1 = sprintService.createSprint({
  name: "Sprint 1 - Foundation",
  start_at: "2025-01-01T00:00:00Z",
  end_at: "2025-01-14T23:59:59Z",
});
sprintService.updateSprint(sprint1.id, { status: "completed" });
console.log(`Created Sprint 1 (completed): ${sprint1.id}`);

const sprint2 = sprintService.createSprint({
  name: "Sprint 2 - Features",
  start_at: "2025-01-15T00:00:00Z",
  end_at: "2025-01-28T23:59:59Z",
});
sprintService.activateSprint(sprint2.id);
console.log(`Created Sprint 2 (active): ${sprint2.id}`);

const sprint3 = sprintService.createSprint({
  name: "Sprint 3 - Polish",
  start_at: "2025-01-29T00:00:00Z",
  end_at: "2025-02-11T23:59:59Z",
});
console.log(`Created Sprint 3 (planning): ${sprint3.id}`);

// Create tasks for Sprint 1 (completed)
console.log("\nCreating Sprint 1 tasks (completed)...");

const s1Tasks = [
  { title: "Set up project structure", priority: "p0" as const },
  { title: "Configure database schema", priority: "p1" as const },
  { title: "Implement CLI framework", priority: "p1" as const },
  { title: "Add basic CRUD operations", priority: "p1" as const },
];

for (const t of s1Tasks) {
  const task = taskService.createTask({ ...t, sprint_id: sprint1.id });
  taskService.transitionTask(task.id, "in_progress");
  taskService.transitionTask(task.id, "completed");
  console.log(`  ✓ ${t.title}`);
}

// Create tasks for Sprint 2 (active) - various states
console.log("\nCreating Sprint 2 tasks (mixed states)...");

// Completed tasks
const completed = [
  { title: "Design MCP server architecture", priority: "p0" as const },
  { title: "Implement task claiming", priority: "p1" as const },
];
for (const t of completed) {
  const task = taskService.createTask({ ...t, sprint_id: sprint2.id });
  taskService.transitionTask(task.id, "in_progress");
  taskService.transitionTask(task.id, "completed");
  console.log(`  ✓ ${t.title} [completed]`);
}

// In progress tasks
const inProgress = [
  { title: "Build web dashboard", priority: "p0" as const, assignee: "agent-1" },
  { title: "Add sprint management", priority: "p1" as const, assignee: "agent-2" },
];
for (const t of inProgress) {
  const task = taskService.createTask({ ...t, sprint_id: sprint2.id });
  taskService.transitionTask(task.id, "in_progress");
  console.log(`  → ${t.title} [in_progress]`);
}

// Blocked task
const blockedTask = taskService.createTask({
  title: "Deploy to production",
  priority: "p0" as const,
  sprint_id: sprint2.id,
  description: "Waiting for security review",
});
taskService.transitionTask(blockedTask.id, "blocked");
console.log(`  ⊘ Deploy to production [blocked]`);

// Pending tasks
const pending = [
  { title: "Write API documentation", priority: "p2" as const },
  { title: "Add bulk operations", priority: "p1" as const },
  { title: "Implement task dependencies", priority: "p1" as const },
  { title: "Create acceptance criteria system", priority: "p2" as const },
];
for (const t of pending) {
  taskService.createTask({ ...t, sprint_id: sprint2.id });
  console.log(`  ○ ${t.title} [pending]`);
}

// Create parent task with subtasks
console.log("\nCreating hierarchical tasks...");
const parentTask = taskService.createTask({
  title: "User authentication system",
  priority: "p0" as const,
  sprint_id: sprint2.id,
  description: "Complete auth implementation",
});
taskService.transitionTask(parentTask.id, "in_progress");
console.log(`  → User authentication system [parent]`);

const subtasks = [
  { title: "Design auth flow", status: "completed" },
  { title: "Implement login endpoint", status: "completed" },
  { title: "Add session management", status: "in_progress" },
  { title: "Create logout functionality", status: "pending" },
];
for (const st of subtasks) {
  const task = taskService.createTask({
    title: st.title,
    parent_id: parentTask.id,
    priority: "p1" as const,
  });
  if (st.status === "completed") {
    taskService.transitionTask(task.id, "in_progress");
    taskService.transitionTask(task.id, "completed");
  } else if (st.status === "in_progress") {
    taskService.transitionTask(task.id, "in_progress");
  }
  const icon = st.status === "completed" ? "✓" : st.status === "in_progress" ? "→" : "○";
  console.log(`    ${icon} ${st.title} [${st.status}]`);
}

// Create tasks for Sprint 3 (planning)
console.log("\nCreating Sprint 3 tasks (all pending)...");

const s3Tasks = [
  { title: "Performance optimization", priority: "p1" as const },
  { title: "Add export/import features", priority: "p2" as const },
  { title: "Create onboarding guide", priority: "p2" as const },
  { title: "Implement task templates", priority: "p3" as const },
  { title: "Add keyboard shortcuts", priority: "p3" as const },
];
for (const t of s3Tasks) {
  taskService.createTask({ ...t, sprint_id: sprint3.id });
  console.log(`  ○ ${t.title}`);
}

// Create task with dependencies
console.log("\nCreating task with dependencies...");
const apiTask = taskService.createTask({
  title: "Build REST API layer",
  priority: "p1" as const,
  sprint_id: sprint2.id,
});
const docsTask = taskService.listTasks({ sprint_id: sprint2.id })
  .find(t => t.title === "Write API documentation");
if (docsTask) {
  taskService.addDependency(docsTask.id, apiTask.id);
  console.log(`  API Documentation depends on REST API layer`);
}

console.log("\n✅ Demo data created successfully!");
console.log(`\nRun the dashboard with:\n  claudia @@ --port 3333`);
