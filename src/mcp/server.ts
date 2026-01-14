import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import * as taskService from "../core/task.js";
import * as sprintService from "../core/sprint.js";
import * as projectService from "../core/project.js";
import type { Project } from "../schemas/project.js";
import * as display from "../utils/display.js";

// Helper to get current project context for responses
function getCurrentProjectContext(): { current_project: Project | null } | Record<string, never> {
  const project = projectService.getCurrentProject();
  return project ? { current_project: project } : {};
}
import { ClaudiaError } from "../utils/errors.js";
import {
  TOOL_DEFINITIONS,
  TaskCreateInput,
  TaskReadInput,
  TaskUpdateInput,
  TaskDeleteInput,
  TaskListInput,
  TaskTransitionInput,
  TaskContextSetInput,
  TaskContextMergeInput,
  TaskContextGetInput,
  TaskTreeInput,
  BulkCreateInput,
  BulkUpdateInput,
  BulkTransitionInput,
  DependencyAddInput,
  DependencyRemoveInput,
  DependencyGetInput,
  TaskClaimInput,
  TaskReleaseInput,
  TaskStartInput,
  TaskFinishInput,
  TaskWorkspaceInput,
  ProjectCreateInput,
  ProjectReadInput,
  ProjectUpdateInput,
  ProjectDeleteInput,
  ProjectSelectInput,
  SprintCreateInput,
  SprintReadInput,
  SprintUpdateInput,
  SprintDeleteInput,
  SprintActivateInput,
} from "./tools.js";

// Session agent ID - auto-generated per MCP connection
import { randomUUID } from "crypto";
const SESSION_AGENT_ID = `session-${randomUUID().slice(0, 8)}`;

export async function startMcpServer(): Promise<void> {
  // Auto-detect or create project based on current working directory
  const cwd = process.cwd();
  let project = projectService.autoDetectProject(cwd);

  if (!project) {
    // No project found - create one automatically
    const projectName = cwd.split("/").pop() || "Untitled Project";
    project = projectService.createProject({
      name: projectName,
      path: cwd,
    });
    projectService.selectProject(project.id);
  }

  const server = new Server(
    {
      name: "claudia",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // CRITICAL WORKFLOW RULES - These MUST be followed
  const WORKFLOW_RULES = `
CRITICAL WORKFLOW RULES FOR CLAUDIA:
=====================================
1. BEFORE working on ANY task: Call task_claim with your agent_id
   - This automatically moves the task to "in_progress"
   - You MUST do this EVERY TIME you start working on a task

2. AFTER completing a task: Call task_transition with status "completed"
   - Do this immediately when you finish the work

3. NEVER skip these steps - task status tracking is essential!
=====================================
`;

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await executeToolCall(name, args ?? {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof ClaudiaError ? error.exitCode : 1;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: { message: errorMessage, code: errorCode } }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const result = await executeToolCall(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: errorMessage }) }],
      isError: true,
    };
  }
}

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // COMPOUND OPERATIONS (REQ-007) - Preferred way to work with tasks
    case "task_start": {
      const input = TaskStartInput.parse(args);
      const task = taskService.startTask(input, SESSION_AGENT_ID);
      return {
        task,
        _info: "Task created and started. It's now in_progress and claimed by you.",
      };
    }

    case "task_finish": {
      const input = TaskFinishInput.parse(args);
      const task = taskService.finishTask(input.id, SESSION_AGENT_ID, input.summary);
      return {
        task,
        _info: "Task completed successfully.",
      };
    }

    case "task_workspace": {
      const input = TaskWorkspaceInput.parse(args);
      const workspace = taskService.getWorkspaceContext(SESSION_AGENT_ID, input.include_completed);
      // Enrich with actual project info if available
      if (workspace.current_project) {
        const project = projectService.getCurrentProject();
        if (project) {
          workspace.current_project = {
            id: project.id,
            name: project.name,
            path: project.path ?? undefined,
          };
        }
      }
      return workspace;
    }

    case "workflow_info": {
      return {
        workflow_rules: {
          preferred: "Use task_start and task_finish - they handle workflow automatically",
          alternative_rule_1: "BEFORE working on any task: Call task_claim with your agent_id - this auto-moves to in_progress",
          alternative_rule_2: "AFTER completing a task: Call task_transition with status 'completed'",
          implicit_workflow: "Any mutation to a pending task auto-claims it for you",
        },
        session_agent_id: SESSION_AGENT_ID,
        reminder: "Prefer task_start/task_finish for automatic workflow handling!",
      };
    }

    case "task_create": {
      const input = TaskCreateInput.parse(args);
      return taskService.createTask(input);
    }

    case "task_read": {
      const input = TaskReadInput.parse(args);
      return taskService.getTask(input.id);
    }

    case "task_update": {
      const input = TaskUpdateInput.parse(args);
      const { id, ...updates } = input;
      // Convert null to undefined for fields that don't accept null
      const cleanUpdates = {
        ...updates,
        priority: updates.priority === null ? undefined : updates.priority,
      };
      // Pass session agent ID for implicit workflow (auto-claim on pending task mutation)
      return taskService.updateTask(id, cleanUpdates, SESSION_AGENT_ID);
    }

    case "task_delete": {
      const input = TaskDeleteInput.parse(args);
      taskService.deleteTask(input.id);
      return { deleted: true, id: input.id };
    }

    case "task_list": {
      const input = TaskListInput.parse(args);
      const tasks = taskService.listTasks(input);
      return {
        tasks,
        ...getCurrentProjectContext(),
        _workflow_reminder: "Before working on any task, call task_claim first to move it to in_progress!",
      };
    }

    case "task_transition": {
      const input = TaskTransitionInput.parse(args);
      return taskService.transitionTask(input.id, input.to);
    }

    case "task_context_set": {
      const input = TaskContextSetInput.parse(args);
      return taskService.setTaskContext(input.id, input.context);
    }

    case "task_context_merge": {
      const input = TaskContextMergeInput.parse(args);
      return taskService.mergeTaskContext(input.id, input.context);
    }

    case "task_context_get": {
      const input = TaskContextGetInput.parse(args);
      return taskService.getTaskContext(input.id);
    }

    case "task_tree": {
      const input = TaskTreeInput.parse(args);
      if (input.id) {
        return { tree: taskService.getTaskTree(input.id, input.depth), ...getCurrentProjectContext() };
      }
      return { tree: taskService.getFullTree(input.depth), ...getCurrentProjectContext() };
    }

    // Bulk tools
    case "task_create_many": {
      const input = BulkCreateInput.parse(args);
      const tasks = input.tasks.map(t => ({
        ...t,
        sprint_id: t.sprint_id ?? input.sprint_id,
        parent_id: t.parent_id ?? input.parent_id,
      }));
      return taskService.createTasksBulk(tasks);
    }

    case "task_update_many": {
      const input = BulkUpdateInput.parse(args);
      // Convert null to undefined for fields that don't accept null
      const cleanUpdates = {
        ...input.updates,
        priority: input.updates.priority === null ? undefined : input.updates.priority,
      };
      return taskService.updateTasksBulk(input.ids, cleanUpdates);
    }

    case "task_transition_many": {
      const input = BulkTransitionInput.parse(args);
      return taskService.transitionTasksBulk(input.ids, input.to, input.skip_invalid);
    }

    // Dependency tools
    case "task_dependency_add": {
      const input = DependencyAddInput.parse(args);
      return taskService.addDependency(input.task_id, input.depends_on_id);
    }

    case "task_dependency_remove": {
      const input = DependencyRemoveInput.parse(args);
      const removed = taskService.removeDependency(input.task_id, input.depends_on_id);
      return { removed, task_id: input.task_id, depends_on_id: input.depends_on_id };
    }

    case "task_dependencies": {
      const input = DependencyGetInput.parse(args);
      const dependencies = taskService.getTaskDependencies(input.task_id);
      const dependents = taskService.getTaskDependents(input.task_id);
      return { task_id: input.task_id, depends_on: dependencies, blocking: dependents };
    }

    case "task_blocked": {
      const tasks = taskService.getBlockedTasks();
      return { tasks, ...getCurrentProjectContext() };
    }

    case "task_ready": {
      const tasks = taskService.getReadyTasks();
      return { tasks, ...getCurrentProjectContext() };
    }

    // Claim/release tools
    case "task_claim": {
      const input = TaskClaimInput.parse(args);
      return taskService.claimTask(input.task_id, input.agent_id);
    }

    case "task_release": {
      const input = TaskReleaseInput.parse(args);
      return taskService.releaseTask(input.task_id, input.agent_id);
    }

    // Sprint tools
    case "sprint_create": {
      const input = SprintCreateInput.parse(args);
      return sprintService.createSprint(input);
    }

    case "sprint_list": {
      const includeArchived = (args as { include_archived?: boolean }).include_archived ?? false;
      const sprints = sprintService.listSprintsWithCounts(includeArchived);
      return { sprints, ...getCurrentProjectContext() };
    }

    case "sprint_show": {
      const input = SprintReadInput.parse(args);
      return sprintService.getSprintWithTasks(input.id);
    }

    case "sprint_update": {
      const input = SprintUpdateInput.parse(args);
      const { id, ...updates } = input;
      return sprintService.updateSprint(id, updates);
    }

    case "sprint_delete": {
      const input = SprintDeleteInput.parse(args);
      sprintService.deleteSprint(input.id);
      return { deleted: true, id: input.id };
    }

    case "sprint_activate": {
      const input = SprintActivateInput.parse(args);
      return sprintService.activateSprint(input.id);
    }

    // Project tools
    case "project_create": {
      const input = ProjectCreateInput.parse(args);
      return projectService.createProject(input);
    }

    case "project_list": {
      return projectService.listProjects();
    }

    case "project_read": {
      const input = ProjectReadInput.parse(args);
      return projectService.getProject(input.id);
    }

    case "project_update": {
      const input = ProjectUpdateInput.parse(args);
      const { id, ...updates } = input;
      return projectService.updateProject(id, updates);
    }

    case "project_delete": {
      const input = ProjectDeleteInput.parse(args);
      projectService.deleteProject(input.id);
      return { deleted: true, id: input.id };
    }

    case "project_select": {
      const input = ProjectSelectInput.parse(args);
      return projectService.selectProject(input.id);
    }

    case "project_current": {
      const cwd = (args as { cwd?: string }).cwd;
      return projectService.getProjectContext(cwd);
    }

    // Display tools
    case "display_tasks": {
      const input = args as {
        status?: string[];
        priority?: string[];
        task_type?: string[];
        limit?: number;
      };
      const tasks = taskService.listTasks({
        status: input.status as any,
        priority: input.priority as any,
        task_type: input.task_type as any,
        limit: input.limit,
      });
      return { display: display.formatTaskTable(tasks), task_count: tasks.length };
    }

    case "display_kanban": {
      const input = args as { task_type?: string[] };
      const tasks = taskService.listTasks({
        task_type: input.task_type as any,
      });
      return { display: display.formatKanbanBoard(tasks), task_count: tasks.length };
    }

    case "display_task": {
      const input = args as { id: string };
      const task = taskService.getTask(input.id);
      return { display: display.formatTaskCard(task) };
    }

    case "display_sprints": {
      const includeArchived = (args as { include_archived?: boolean }).include_archived ?? false;
      const sprints = sprintService.listSprintsWithCounts(includeArchived);
      return { display: display.formatSprintList(sprints) };
    }

    case "display_sprint": {
      const input = args as { id: string };
      const sprint = sprintService.getSprintWithTasks(input.id);
      return { display: display.formatSprintCard(sprint) };
    }

    case "display_progress": {
      const project = projectService.getCurrentProject();
      const projectName = project?.name || "All Tasks";
      const tasks = taskService.listTasks({});
      const sprints = sprintService.listSprintsWithCounts(false);
      return { display: display.formatProjectSummary(projectName, tasks, sprints) };
    }

    case "display_legend": {
      return { display: display.formatLegend() };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
