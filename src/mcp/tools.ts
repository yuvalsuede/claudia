import { z } from "zod";

// Task type enum
const TaskTypeEnum = z.enum(["feature", "bugfix", "planning", "development", "ui", "refactor", "docs", "test", "chore"]);

// Task image schema
const TaskImageInput = z.object({
  id: z.string().describe("Unique image ID"),
  url: z.string().optional().describe("External URL"),
  path: z.string().optional().describe("Local file path"),
  base64: z.string().optional().describe("Base64 encoded image data"),
  caption: z.string().optional().describe("Image caption"),
  created_at: z.string().datetime().describe("Creation timestamp"),
});

// Tool input schemas
export const TaskCreateInput = z.object({
  title: z.string().min(1).max(500).describe("Task title"),
  description: z.string().max(10240).optional().describe("Task description"),
  priority: z.enum(["p0", "p1", "p2", "p3"]).optional().describe("Task priority"),
  task_type: TaskTypeEnum.optional().describe("Task type (feature, bugfix, planning, development, ui, refactor, docs, test, chore)"),
  parent_id: z.string().uuid().optional().describe("Parent task ID"),
  status: z.enum(["pending", "in_progress", "blocked", "completed", "archived"]).optional().describe("Initial status"),
  tags: z.array(z.string()).optional().describe("Task tags"),
  assignee: z.string().optional().describe("Task assignee"),
  due_at: z.string().datetime().optional().describe("Due date (ISO8601)"),
  context: z.record(z.unknown()).optional().describe("Agent context (JSON, max 64KB)"),
  metadata: z.record(z.unknown()).optional().describe("Custom metadata"),
  images: z.array(TaskImageInput).optional().describe("Attached images"),
});

export const TaskReadInput = z.object({
  id: z.string().uuid().describe("Task ID"),
});

export const TaskUpdateInput = z.object({
  id: z.string().uuid().describe("Task ID"),
  title: z.string().min(1).max(500).optional().describe("New title"),
  description: z.string().max(10240).optional().describe("New description"),
  priority: z.enum(["p0", "p1", "p2", "p3"]).nullable().optional().describe("New priority"),
  task_type: TaskTypeEnum.nullable().optional().describe("New task type"),
  parent_id: z.string().uuid().nullable().optional().describe("New parent ID (null to clear)"),
  status: z.enum(["pending", "in_progress", "blocked", "completed", "archived"]).optional().describe("New status"),
  tags: z.array(z.string()).optional().describe("New tags"),
  assignee: z.string().nullable().optional().describe("New assignee"),
  due_at: z.string().datetime().nullable().optional().describe("New due date"),
  images: z.array(TaskImageInput).optional().describe("Updated images"),
  version: z.number().int().positive().optional().describe("Expected version for optimistic locking"),
});

export const TaskDeleteInput = z.object({
  id: z.string().uuid().describe("Task ID"),
});

export const TaskListInput = z.object({
  status: z.array(z.enum(["pending", "in_progress", "blocked", "completed", "archived"])).optional().describe("Filter by status"),
  priority: z.array(z.enum(["p0", "p1", "p2", "p3"])).optional().describe("Filter by priority"),
  task_type: z.array(TaskTypeEnum).optional().describe("Filter by task type"),
  parent_id: z.string().uuid().optional().describe("Filter by parent task ID"),
  assignee: z.string().optional().describe("Filter by assignee"),
  limit: z.number().int().positive().max(1000).optional().describe("Maximum results"),
  offset: z.number().int().nonnegative().optional().describe("Results offset"),
  sort: z.array(z.string()).optional().describe("Sort fields (prefix with - for desc)"),
  include_archived: z.boolean().optional().describe("Include archived tasks"),
});

export const TaskTransitionInput = z.object({
  id: z.string().uuid().describe("Task ID"),
  to: z.enum(["pending", "in_progress", "blocked", "completed", "archived"]).describe("Target status"),
});

export const TaskContextSetInput = z.object({
  id: z.string().uuid().describe("Task ID"),
  context: z.record(z.unknown()).describe("Context to set (overwrites existing)"),
});

export const TaskContextMergeInput = z.object({
  id: z.string().uuid().describe("Task ID"),
  context: z.record(z.unknown()).describe("Context to merge (deep merge)"),
});

export const TaskContextGetInput = z.object({
  id: z.string().uuid().describe("Task ID"),
});

export const TaskTreeInput = z.object({
  id: z.string().uuid().optional().describe("Task ID (omit for full tree)"),
  depth: z.number().int().positive().max(10).optional().describe("Maximum depth"),
});

// Bulk inputs
export const BulkCreateInput = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(10240).optional(),
    priority: z.enum(["p0", "p1", "p2", "p3"]).optional(),
    task_type: TaskTypeEnum.optional(),
    parent_id: z.string().uuid().optional(),
    sprint_id: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
  })).max(100).describe("Array of task definitions"),
  sprint_id: z.string().uuid().optional().describe("Assign all tasks to this sprint"),
  parent_id: z.string().uuid().optional().describe("Create all as children of this task"),
});

export const BulkUpdateInput = z.object({
  ids: z.array(z.string().uuid()).describe("Task IDs to update"),
  updates: z.object({
    status: z.enum(["pending", "in_progress", "blocked", "completed", "archived"]).optional(),
    priority: z.enum(["p0", "p1", "p2", "p3"]).nullable().optional(),
    sprint_id: z.string().uuid().nullable().optional(),
    assignee: z.string().nullable().optional(),
  }).describe("Fields to update"),
});

export const BulkTransitionInput = z.object({
  ids: z.array(z.string().uuid()).describe("Task IDs to transition"),
  to: z.enum(["pending", "in_progress", "blocked", "completed", "archived"]).describe("Target status"),
  skip_invalid: z.boolean().optional().describe("Skip tasks that fail validation"),
});

// Dependency inputs
export const DependencyAddInput = z.object({
  task_id: z.string().uuid().describe("Task ID"),
  depends_on_id: z.string().uuid().describe("ID of task this depends on"),
});

export const DependencyRemoveInput = z.object({
  task_id: z.string().uuid().describe("Task ID"),
  depends_on_id: z.string().uuid().describe("ID of dependency to remove"),
});

export const DependencyGetInput = z.object({
  task_id: z.string().uuid().describe("Task ID"),
});

// Claim/release inputs
export const TaskClaimInput = z.object({
  task_id: z.string().uuid().describe("Task ID to claim"),
  agent_id: z.string().min(1).describe("Agent identifier claiming the task"),
});

export const TaskReleaseInput = z.object({
  task_id: z.string().uuid().describe("Task ID to release"),
  agent_id: z.string().min(1).describe("Agent identifier releasing the task"),
});

// Compound operation inputs (REQ-007)
export const TaskStartInput = z.object({
  title: z.string().min(1).max(500).describe("Task title"),
  description: z.string().max(10240).optional().describe("Task description"),
  priority: z.enum(["p0", "p1", "p2", "p3"]).optional().describe("Task priority"),
  task_type: TaskTypeEnum.optional().describe("Task type"),
  parent_id: z.string().uuid().optional().describe("Parent task ID"),
  tags: z.array(z.string()).optional().describe("Task tags"),
  context: z.record(z.unknown()).optional().describe("Initial context"),
});

export const TaskFinishInput = z.object({
  id: z.string().uuid().describe("Task ID to finish"),
  summary: z.string().max(10240).optional().describe("Completion summary"),
});

// Session context input (REQ-003)
export const TaskWorkspaceInput = z.object({
  include_completed: z.boolean().optional().describe("Include recently completed tasks (last 24h)"),
});

// Project inputs
export const ProjectCreateInput = z.object({
  name: z.string().min(1).max(200).describe("Project name"),
  path: z.string().optional().describe("Project directory path"),
  description: z.string().max(2000).optional().describe("Project description"),
});

export const ProjectReadInput = z.object({
  id: z.string().uuid().describe("Project ID"),
});

export const ProjectUpdateInput = z.object({
  id: z.string().uuid().describe("Project ID"),
  name: z.string().min(1).max(200).optional().describe("New name"),
  path: z.string().nullable().optional().describe("New path (null to clear)"),
  description: z.string().max(2000).nullable().optional().describe("New description (null to clear)"),
});

export const ProjectDeleteInput = z.object({
  id: z.string().uuid().describe("Project ID"),
});

export const ProjectSelectInput = z.object({
  id: z.string().uuid().describe("Project ID to select"),
});

// Sprint inputs
export const SprintCreateInput = z.object({
  name: z.string().min(1).max(200).describe("Sprint name"),
  start_at: z.string().datetime().optional().describe("Start date (ISO8601)"),
  end_at: z.string().datetime().optional().describe("End date (ISO8601)"),
});

export const SprintReadInput = z.object({
  id: z.string().uuid().describe("Sprint ID"),
});

export const SprintUpdateInput = z.object({
  id: z.string().uuid().describe("Sprint ID"),
  name: z.string().min(1).max(200).optional().describe("New name"),
  status: z.enum(["planning", "active", "completed", "archived"]).optional().describe("New status"),
  start_at: z.string().datetime().nullable().optional().describe("New start date"),
  end_at: z.string().datetime().nullable().optional().describe("New end date"),
});

export const SprintDeleteInput = z.object({
  id: z.string().uuid().describe("Sprint ID"),
});

export const SprintActivateInput = z.object({
  id: z.string().uuid().describe("Sprint ID to activate"),
});

// Tool definitions for MCP
export const TOOL_DEFINITIONS = [
  // COMPOUND OPERATIONS - PREFERRED WAY TO WORK WITH TASKS
  // These tools automatically handle workflow transitions correctly
  {
    name: "task_start",
    description: `RECOMMENDED: Create a new task AND immediately start working on it.
This is the preferred way to create tasks you'll work on right away.
Automatically sets status to "in_progress" and claims the task for you.

Use this instead of: task_create + task_claim

Returns the created task (already in_progress).`,
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: ["p0", "p1", "p2", "p3"], description: "Priority level" },
        task_type: { type: "string", enum: ["feature", "bugfix", "planning", "development", "ui", "refactor", "docs", "test", "chore"], description: "Task type" },
        parent_id: { type: "string", description: "Parent task UUID" },
        tags: { type: "array", items: { type: "string" }, description: "Task tags" },
        context: { type: "object", description: "Initial context" },
      },
      required: ["title"],
    },
  },
  {
    name: "task_finish",
    description: `RECOMMENDED: Complete a task you're working on.
This is the preferred way to mark a task as done.
Optionally provide a completion summary.

Use this instead of: task_transition(id, "completed")

The task must be in_progress and claimed by you.
Returns the completed task.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID to finish" },
        summary: { type: "string", description: "Optional completion summary" },
      },
      required: ["id"],
    },
  },
  {
    name: "task_workspace",
    description: `SESSION CONTEXT: Call this when starting a new session to understand your workspace.
Returns:
- Your session agent ID
- Tasks currently in_progress (yours and orphaned)
- Pending tasks ready to work on
- Suggested next actions
- Current project context

This helps you resume work or pick up where another session left off.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        include_completed: { type: "boolean", description: "Include recently completed tasks (last 24h)" },
      },
    },
  },
  // WORKFLOW RULES - READ THIS FIRST
  {
    name: "workflow_info",
    description: `WORKFLOW REFERENCE:

PREFERRED: Use compound operations (task_start, task_finish) - they handle workflow automatically.

ALTERNATIVE: If using separate operations:
1. STARTING WORK: Call task_claim first → auto-moves to "in_progress"
2. FINISHING WORK: Call task_transition(id, "completed")

Note: Any mutation to a pending task now auto-claims it (implicit workflow).

Returns the current workflow rules.`,
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "task_create",
    description: "Create a new task with optional parent, priority, and metadata. Returns the created task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: ["p0", "p1", "p2", "p3"], description: "Priority level" },
        parent_id: { type: "string", description: "Parent task UUID" },
        status: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"], description: "Initial status" },
        tags: { type: "array", items: { type: "string" }, description: "Task tags" },
        assignee: { type: "string", description: "Task assignee" },
        due_at: { type: "string", description: "Due date (ISO8601)" },
        context: { type: "object", description: "Agent context (JSON, max 64KB)" },
        metadata: { type: "object", description: "Custom metadata" },
      },
      required: ["title"],
    },
  },
  {
    name: "task_read",
    description: "Retrieve a single task by ID with full details including context and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "task_update",
    description: "Update one or more fields on an existing task. Returns the updated task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        priority: { type: ["string", "null"], enum: ["p0", "p1", "p2", "p3", null], description: "New priority (null to clear)" },
        parent_id: { type: ["string", "null"], description: "New parent UUID (null to clear)" },
        status: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"], description: "New status" },
        tags: { type: "array", items: { type: "string" }, description: "New tags" },
        assignee: { type: ["string", "null"], description: "New assignee (null to clear)" },
        due_at: { type: ["string", "null"], description: "New due date (null to clear)" },
        version: { type: "integer", description: "Expected version for optimistic locking" },
      },
      required: ["id"],
    },
  },
  {
    name: "task_delete",
    description: "Delete a task by ID. Children are orphaned (parent_id set to null).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "task_list",
    description: "Query tasks with filtering, sorting, and pagination. Returns array of tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "array", items: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"] }, description: "Filter by status" },
        priority: { type: "array", items: { type: "string", enum: ["p0", "p1", "p2", "p3"] }, description: "Filter by priority" },
        parent_id: { type: "string", description: "Filter by parent task UUID" },
        assignee: { type: "string", description: "Filter by assignee" },
        limit: { type: "integer", description: "Maximum results (default: 100)" },
        offset: { type: "integer", description: "Results offset" },
        sort: { type: "array", items: { type: "string" }, description: "Sort fields (prefix with - for desc)" },
        include_archived: { type: "boolean", description: "Include archived tasks" },
      },
    },
  },
  {
    name: "task_transition",
    description: "Change task status with workflow validation. IMPORTANT: Use this to mark task as 'completed' when you finish working on it. Returns the updated task and transition details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
        to: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"], description: "Target status" },
      },
      required: ["id", "to"],
    },
  },
  {
    name: "task_context_set",
    description: "Store agent context/memory on a task (overwrites existing). Max 64KB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
        context: { type: "object", description: "Context to set" },
      },
      required: ["id", "context"],
    },
  },
  {
    name: "task_context_merge",
    description: "Merge context into existing task context (deep merge). Max 64KB total.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
        context: { type: "object", description: "Context to merge" },
      },
      required: ["id", "context"],
    },
  },
  {
    name: "task_context_get",
    description: "Retrieve stored agent context from a task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "task_tree",
    description: "Get hierarchical view of task and all descendants.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID (omit for full tree)" },
        depth: { type: "integer", description: "Maximum depth (default: 5)" },
      },
    },
  },
  // Bulk tools
  {
    name: "task_create_many",
    description: "Create multiple tasks atomically (max 100). Returns array of created tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              description: { type: "string", description: "Task description" },
              priority: { type: "string", enum: ["p0", "p1", "p2", "p3"], description: "Priority" },
            },
            required: ["title"],
          },
          description: "Array of task definitions (max 100)",
        },
        sprint_id: { type: "string", description: "Assign all tasks to this sprint" },
        parent_id: { type: "string", description: "Create all as children of this task" },
      },
      required: ["tasks"],
    },
  },
  {
    name: "task_update_many",
    description: "Update multiple tasks with the same changes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Task UUIDs to update" },
        updates: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"] },
            priority: { type: ["string", "null"], enum: ["p0", "p1", "p2", "p3", null] },
            sprint_id: { type: ["string", "null"] },
            assignee: { type: ["string", "null"] },
          },
          description: "Fields to update",
        },
      },
      required: ["ids", "updates"],
    },
  },
  {
    name: "task_transition_many",
    description: "Transition multiple tasks to a new status with validation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Task UUIDs to transition" },
        to: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"], description: "Target status" },
        skip_invalid: { type: "boolean", description: "Skip tasks that fail validation instead of failing entirely" },
      },
      required: ["ids", "to"],
    },
  },
  // Dependency tools
  {
    name: "task_dependency_add",
    description: "Add a dependency between tasks (task depends on another).",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task UUID" },
        depends_on_id: { type: "string", description: "UUID of task this depends on" },
      },
      required: ["task_id", "depends_on_id"],
    },
  },
  {
    name: "task_dependency_remove",
    description: "Remove a dependency between tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task UUID" },
        depends_on_id: { type: "string", description: "UUID of dependency to remove" },
      },
      required: ["task_id", "depends_on_id"],
    },
  },
  {
    name: "task_dependencies",
    description: "Get dependencies and dependents for a task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task UUID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "task_blocked",
    description: "List tasks with unsatisfied dependencies.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "task_ready",
    description: "List tasks ready to work on (all dependencies satisfied).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // Claim/release tools
  // WORKFLOW: Use task_claim when STARTING work (auto-transitions to in_progress)
  //           Use task_transition to 'completed' when FINISHING work
  {
    name: "task_claim",
    description: "CRITICAL: Use this when starting work on a task. Atomically claims the task AND automatically transitions it to 'in_progress'. You MUST call this before working on any task. Returns success status and the updated task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task UUID to claim" },
        agent_id: { type: "string", description: "Agent identifier claiming the task" },
      },
      required: ["task_id", "agent_id"],
    },
  },
  {
    name: "task_release",
    description: "Release a claimed task. Only succeeds if task is claimed by the specified agent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task UUID to release" },
        agent_id: { type: "string", description: "Agent identifier releasing the task" },
      },
      required: ["task_id", "agent_id"],
    },
  },
  // Sprint tools
  {
    name: "sprint_create",
    description: "Create a new sprint with optional date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Sprint name" },
        start_at: { type: "string", description: "Start date (ISO8601)" },
        end_at: { type: "string", description: "End date (ISO8601)" },
      },
      required: ["name"],
    },
  },
  {
    name: "sprint_list",
    description: "List all sprints with status and task counts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        include_archived: { type: "boolean", description: "Include archived sprints" },
      },
    },
  },
  {
    name: "sprint_show",
    description: "Get sprint details with associated tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Sprint UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "sprint_update",
    description: "Update sprint properties.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Sprint UUID" },
        name: { type: "string", description: "New name" },
        status: { type: "string", enum: ["planning", "active", "completed", "archived"], description: "New status" },
        start_at: { type: ["string", "null"], description: "New start date (null to clear)" },
        end_at: { type: ["string", "null"], description: "New end date (null to clear)" },
      },
      required: ["id"],
    },
  },
  {
    name: "sprint_delete",
    description: "Delete a sprint (tasks are unassigned, not deleted).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Sprint UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "sprint_activate",
    description: "Set a sprint as the active sprint.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Sprint UUID" },
      },
      required: ["id"],
    },
  },
  // Project tools
  {
    name: "project_create",
    description: "Create a new project. Projects group tasks and sprints together.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Project name" },
        path: { type: "string", description: "Project directory path (for auto-detection)" },
        description: { type: "string", description: "Project description" },
      },
      required: ["name"],
    },
  },
  {
    name: "project_list",
    description: "List all projects.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "project_read",
    description: "Get project details by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Project UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "project_update",
    description: "Update project properties.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Project UUID" },
        name: { type: "string", description: "New name" },
        path: { type: ["string", "null"], description: "New path (null to clear)" },
        description: { type: ["string", "null"], description: "New description (null to clear)" },
      },
      required: ["id"],
    },
  },
  {
    name: "project_delete",
    description: "Delete a project. Tasks and sprints in the project are orphaned (project_id set to null).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Project UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "project_select",
    description: "Select a project as the current working project. Subsequent task/sprint operations will be scoped to this project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Project UUID to select" },
      },
      required: ["id"],
    },
  },
  {
    name: "project_current",
    description: "Get the currently selected project. If no project is selected, returns null with a list of available projects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cwd: { type: "string", description: "Current working directory for auto-detection (optional)" },
      },
    },
  },
  // Display tools - formatted CLI output
  {
    name: "display_tasks",
    description: "Display tasks in a formatted CLI table view. Great for visual overview of task status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "array", items: { type: "string", enum: ["pending", "in_progress", "blocked", "completed", "archived"] }, description: "Filter by status" },
        priority: { type: "array", items: { type: "string", enum: ["p0", "p1", "p2", "p3"] }, description: "Filter by priority" },
        task_type: { type: "array", items: { type: "string", enum: ["feature", "bugfix", "planning", "development", "ui", "refactor", "docs", "test", "chore"] }, description: "Filter by task type" },
        limit: { type: "integer", description: "Maximum tasks to show" },
      },
    },
  },
  {
    name: "display_kanban",
    description: "Display tasks in a Kanban board format with columns for each status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_type: { type: "array", items: { type: "string" }, description: "Filter by task type" },
      },
    },
  },
  {
    name: "display_task",
    description: "Display a single task as a detailed card with all information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "display_sprints",
    description: "Display all sprints in a formatted list with progress indicators.",
    inputSchema: {
      type: "object" as const,
      properties: {
        include_archived: { type: "boolean", description: "Include archived sprints" },
      },
    },
  },
  {
    name: "display_sprint",
    description: "Display a sprint as a detailed card with task breakdown and progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Sprint UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "display_progress",
    description: "Display project progress summary with charts and statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "display_legend",
    description: "Display the legend for status icons, priority indicators, and task types.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];
