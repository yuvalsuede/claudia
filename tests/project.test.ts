import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, cleanupTestDb } from "./setup";
import * as projectService from "../src/core/project";
import * as taskService from "../src/core/task";
import * as sprintService from "../src/core/sprint";
import { closeDb } from "../src/db/client";
import { handleToolCall } from "../src/mcp/server";

describe("Project CRUD", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create project with name only", () => {
    const project = projectService.createProject({ name: "Test Project" });

    expect(project).toBeDefined();
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(project.name).toBe("Test Project");
    expect(project.path).toBeUndefined();
  });

  test("create project with path", () => {
    const project = projectService.createProject({
      name: "Path Project",
      path: "/Users/test/projects/my-app",
    });

    expect(project.name).toBe("Path Project");
    expect(project.path).toBe("/Users/test/projects/my-app");
  });

  test("create project with description", () => {
    const project = projectService.createProject({
      name: "Described Project",
      description: "A test project with a description",
    });

    expect(project.description).toBe("A test project with a description");
  });

  test("duplicate path throws validation error", () => {
    projectService.createProject({
      name: "First Project",
      path: "/unique/path/project",
    });

    expect(() => {
      projectService.createProject({
        name: "Second Project",
        path: "/unique/path/project",
      });
    }).toThrow("already exists");
  });

  test("get project", () => {
    const created = projectService.createProject({ name: "Get Project" });
    const fetched = projectService.getProject(created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Get Project");
  });

  test("get non-existent project throws NotFoundError", () => {
    expect(() => {
      projectService.getProject("00000000-0000-0000-0000-000000000000");
    }).toThrow("Project not found");
  });

  test("update project name", () => {
    const project = projectService.createProject({ name: "Update Project" });

    const updated = projectService.updateProject(project.id, {
      name: "Updated Name",
    });

    expect(updated.name).toBe("Updated Name");
  });

  test("update project path", () => {
    const project = projectService.createProject({ name: "Update Path" });

    const updated = projectService.updateProject(project.id, {
      path: "/new/path",
    });

    expect(updated.path).toBe("/new/path");
  });

  test("clear project path with null", () => {
    const project = projectService.createProject({
      name: "Clear Path",
      path: "/some/path",
    });

    const updated = projectService.updateProject(project.id, {
      path: null,
    });

    expect(updated.path).toBeUndefined();
  });

  test("delete project", () => {
    const project = projectService.createProject({ name: "Delete Project" });

    projectService.deleteProject(project.id);

    expect(() => {
      projectService.getProject(project.id);
    }).toThrow("Project not found");
  });

  test("list projects", () => {
    projectService.createProject({ name: "List Project 1" });
    projectService.createProject({ name: "List Project 2" });

    const projects = projectService.listProjects();
    expect(projects.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Project Path Detection", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("get project by exact path", () => {
    const project = projectService.createProject({
      name: "Exact Path",
      path: "/Users/test/exact-project",
    });

    const found = projectService.getProjectByPath("/Users/test/exact-project");

    expect(found).toBeDefined();
    expect(found?.id).toBe(project.id);
  });

  test("find project for subdirectory", () => {
    const project = projectService.createProject({
      name: "Parent Path",
      path: "/Users/test/parent-project",
    });

    const found = projectService.findProjectForDirectory("/Users/test/parent-project/src/lib");

    expect(found).toBeDefined();
    expect(found?.id).toBe(project.id);
  });

  test("returns null for unrelated directory", () => {
    projectService.createProject({
      name: "Unrelated",
      path: "/Users/test/unrelated",
    });

    const found = projectService.findProjectForDirectory("/Users/other/directory");

    expect(found).toBeNull();
  });

  test("returns most specific project match", () => {
    projectService.createProject({
      name: "Parent",
      path: "/Users/test/workspace",
    });
    const nested = projectService.createProject({
      name: "Nested",
      path: "/Users/test/workspace/nested-project",
    });

    const found = projectService.findProjectForDirectory("/Users/test/workspace/nested-project/src");

    expect(found).toBeDefined();
    expect(found?.id).toBe(nested.id);
  });
});

describe("Project Context Management", () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("select project sets current project", () => {
    const project = projectService.createProject({ name: "Select Project" });

    projectService.selectProject(project.id);

    const current = projectService.getCurrentProject();
    expect(current).toBeDefined();
    expect(current?.id).toBe(project.id);
  });

  test("getCurrentProject returns null when none selected", () => {
    const current = projectService.getCurrentProject();
    expect(current).toBeNull();
  });

  test("clearCurrentProject clears selection", () => {
    const project = projectService.createProject({ name: "Clear Project" });
    projectService.selectProject(project.id);

    projectService.clearCurrentProject();

    const current = projectService.getCurrentProject();
    expect(current).toBeNull();
  });

  test("autoDetectProject sets current from path", () => {
    const project = projectService.createProject({
      name: "Auto Detect",
      path: "/Users/test/auto-detect",
    });

    const detected = projectService.autoDetectProject("/Users/test/auto-detect/src");

    expect(detected).toBeDefined();
    expect(detected?.id).toBe(project.id);

    const current = projectService.getCurrentProject();
    expect(current?.id).toBe(project.id);
  });

  test("getProjectContext returns context info", () => {
    const project = projectService.createProject({
      name: "Context Project",
      path: "/Users/test/context-project",
    });

    const context = projectService.getProjectContext("/Users/test/context-project");

    expect(context.project).toBeDefined();
    expect(context.project?.id).toBe(project.id);
    expect(context.detected).toBe(true);
    expect(Array.isArray(context.available)).toBe(true);
  });

  test("deleting selected project clears current", () => {
    const project = projectService.createProject({ name: "Delete Selected" });
    projectService.selectProject(project.id);

    projectService.deleteProject(project.id);

    const current = projectService.getCurrentProject();
    expect(current).toBeNull();
  });
});

describe("Project with Tasks", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create task with project_id", () => {
    const project = projectService.createProject({ name: "Task Project" });
    const task = taskService.createTask({
      title: "Project Task",
      project_id: project.id,
    });

    expect(task.project_id).toBe(project.id);
  });

  test("list tasks by project", () => {
    const project = projectService.createProject({ name: "Filter Project" });
    taskService.createTask({ title: "Project task 1", project_id: project.id });
    taskService.createTask({ title: "Project task 2", project_id: project.id });
    taskService.createTask({ title: "Other task" });

    const projectTasks = taskService.listTasks({ project_id: project.id });

    expect(projectTasks.length).toBe(2);
    expect(projectTasks.every(t => t.project_id === project.id)).toBe(true);
  });

  test("update task project assignment", () => {
    const project1 = projectService.createProject({ name: "Project 1" });
    const project2 = projectService.createProject({ name: "Project 2" });
    const task = taskService.createTask({
      title: "Reassign Task",
      project_id: project1.id,
    });

    const updated = taskService.updateTask(task.id, { project_id: project2.id });

    expect(updated.project_id).toBe(project2.id);
  });
});

describe("Project with Sprints", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("create sprint with project_id", () => {
    const project = projectService.createProject({ name: "Sprint Project" });
    const sprint = sprintService.createSprint({
      name: "Project Sprint",
      project_id: project.id,
    });

    expect(sprint.project_id).toBe(project.id);
  });

  test("list sprints includes project_id", () => {
    const project = projectService.createProject({ name: "List Sprint Project" });
    sprintService.createSprint({
      name: "Sprint with project",
      project_id: project.id,
    });

    const sprints = sprintService.listSprints();
    const found = sprints.find(s => s.project_id === project.id);

    expect(found).toBeDefined();
  });
});

describe("MCP Project Tools", () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("project_create creates project", async () => {
    const result = await handleToolCall("project_create", { name: "MCP Project" });
    expect(result.content[0].type).toBe("text");

    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("MCP Project");
    expect(data.id).toBeDefined();
  });

  test("project_create with path", async () => {
    const result = await handleToolCall("project_create", {
      name: "MCP Path Project",
      path: "/Users/mcp/project",
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.path).toBe("/Users/mcp/project");
  });

  test("project_read retrieves project", async () => {
    const createResult = await handleToolCall("project_create", { name: "Read MCP Project" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("project_read", { id: created.id });
    const data = JSON.parse(result.content[0].text);

    expect(data.id).toBe(created.id);
    expect(data.name).toBe("Read MCP Project");
  });

  test("project_update modifies project", async () => {
    const createResult = await handleToolCall("project_create", { name: "Update MCP Project" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("project_update", {
      id: created.id,
      name: "Updated MCP Project",
      description: "New description",
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.name).toBe("Updated MCP Project");
    expect(data.description).toBe("New description");
  });

  test("project_delete removes project", async () => {
    const createResult = await handleToolCall("project_create", { name: "Delete MCP Project" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("project_delete", { id: created.id });
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);

    const readResult = await handleToolCall("project_read", { id: created.id });
    expect(readResult.isError).toBe(true);
  });

  test("project_list returns projects", async () => {
    await handleToolCall("project_create", { name: "List MCP 1" });
    await handleToolCall("project_create", { name: "List MCP 2" });

    const result = await handleToolCall("project_list", {});
    const data = JSON.parse(result.content[0].text);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  test("project_select sets current project", async () => {
    const createResult = await handleToolCall("project_create", { name: "Select MCP Project" });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("project_select", { id: created.id });
    const data = JSON.parse(result.content[0].text);

    expect(data.id).toBe(created.id);

    const current = projectService.getCurrentProject();
    expect(current?.id).toBe(created.id);
  });

  test("project_current returns context", async () => {
    const createResult = await handleToolCall("project_create", {
      name: "Current MCP Project",
      path: "/Users/mcp/current",
    });
    const created = JSON.parse(createResult.content[0].text);

    const result = await handleToolCall("project_current", { cwd: "/Users/mcp/current/src" });
    const data = JSON.parse(result.content[0].text);

    expect(data.project).toBeDefined();
    expect(data.project.id).toBe(created.id);
    expect(data.detected).toBe(true);
    expect(Array.isArray(data.available)).toBe(true);
  });

  test("project_current with no match", async () => {
    const result = await handleToolCall("project_current", { cwd: "/Users/unknown/path" });
    const data = JSON.parse(result.content[0].text);

    expect(data.project).toBeNull();
    expect(data.detected).toBe(false);
  });

  test("project_current returns prompt when no project selected", async () => {
    // Create a project but don't select it
    await handleToolCall("project_create", { name: "Prompt Test Project" });

    // Clear any selection
    projectService.clearCurrentProject();

    const result = await handleToolCall("project_current", {});
    const data = JSON.parse(result.content[0].text);

    expect(data.project).toBeNull();
    expect(data.prompt).toBeDefined();
    expect(data.prompt).toContain("No project selected");
    expect(data.prompt).toContain("Prompt Test Project");
  });
});

describe("Project Filtering Behavior", () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    projectService.clearCurrentProject();
  });

  afterAll(() => {
    closeDb();
    cleanupTestDb();
  });

  test("tasks are auto-assigned to current project", () => {
    const project = projectService.createProject({ name: "Auto Assign Project" });
    projectService.selectProject(project.id);

    const task = taskService.createTask({ title: "Auto assigned task" });

    expect(task.project_id).toBe(project.id);
  });

  test("task_list filters by current project", () => {
    const project1 = projectService.createProject({ name: "Filter Project 1" });
    const project2 = projectService.createProject({ name: "Filter Project 2" });

    projectService.selectProject(project1.id);
    taskService.createTask({ title: "Project 1 task" });

    projectService.selectProject(project2.id);
    taskService.createTask({ title: "Project 2 task" });

    // When project 2 is selected, should only see project 2 tasks
    const project2Tasks = taskService.listTasks();
    expect(project2Tasks.every(t => t.project_id === project2.id)).toBe(true);

    // When project 1 is selected, should only see project 1 tasks
    projectService.selectProject(project1.id);
    const project1Tasks = taskService.listTasks();
    expect(project1Tasks.every(t => t.project_id === project1.id)).toBe(true);
  });

  test("getFullTree filters by current project", () => {
    const project = projectService.createProject({ name: "Tree Project" });
    projectService.selectProject(project.id);

    const parent = taskService.createTask({ title: "Tree parent" });
    taskService.createTask({ title: "Tree child", parent_id: parent.id });

    // Create task in different project
    projectService.clearCurrentProject();
    taskService.createTask({ title: "Other project task" });

    // Select project and verify tree only shows project tasks
    projectService.selectProject(project.id);
    const tree = taskService.getFullTree();

    expect(tree.length).toBe(1);
    expect(tree[0].title).toBe("Tree parent");
    expect(tree[0].children.length).toBe(1);
  });

  test("sprints are auto-assigned to current project", () => {
    const project = projectService.createProject({ name: "Sprint Auto Project" });
    projectService.selectProject(project.id);

    const sprint = sprintService.createSprint({ name: "Auto Sprint" });

    expect(sprint.project_id).toBe(project.id);
  });

  test("listSprints filters by current project", () => {
    const project1 = projectService.createProject({ name: "Sprint Project 1" });
    const project2 = projectService.createProject({ name: "Sprint Project 2" });

    projectService.selectProject(project1.id);
    sprintService.createSprint({ name: "Sprint in P1" });

    projectService.selectProject(project2.id);
    sprintService.createSprint({ name: "Sprint in P2" });

    // When project 2 is selected, should only see project 2 sprints
    const project2Sprints = sprintService.listSprints();
    expect(project2Sprints.every(s => s.project_id === project2.id)).toBe(true);

    // When project 1 is selected, should only see project 1 sprints
    projectService.selectProject(project1.id);
    const project1Sprints = sprintService.listSprints();
    expect(project1Sprints.every(s => s.project_id === project1.id)).toBe(true);
  });

  test("no filtering when no project selected", () => {
    const project = projectService.createProject({ name: "No Filter Project" });
    projectService.selectProject(project.id);

    taskService.createTask({ title: "Task with project" });

    projectService.clearCurrentProject();
    taskService.createTask({ title: "Task without project" });

    // With no project selected, should see all tasks
    const allTasks = taskService.listTasks();
    expect(allTasks.length).toBeGreaterThanOrEqual(2);
  });

  test("bulk create auto-assigns project", () => {
    const project = projectService.createProject({ name: "Bulk Auto Project" });
    projectService.selectProject(project.id);

    const tasks = taskService.createTasksBulk([
      { title: "Bulk 1" },
      { title: "Bulk 2" },
    ]);

    expect(tasks.every(t => t.project_id === project.id)).toBe(true);
  });
});
