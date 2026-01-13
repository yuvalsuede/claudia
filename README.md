# Claudia

A CLI task manager designed for AI agents, with full MCP (Model Context Protocol) server support.

## Features

- **Task Management**: Create, read, update, delete tasks with hierarchical parent-child relationships
- **State Machine**: Validated status transitions (pending → in_progress → completed)
- **Dependencies**: Track task dependencies with automatic cycle detection
- **Sprints**: Group tasks into sprints for organized work periods
- **Projects**: Multi-project support with auto-detection from working directory
- **Context Storage**: Store up to 64KB of JSON context per task for agent memory
- **MCP Server**: Drop-in MCP server for Claude Code and other MCP-compatible clients
- **Bulk Operations**: Atomic batch create, update, and transition operations
- **Multiple Output Formats**: JSON (default), YAML, and human-readable text

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)

### Install from source

```bash
git clone https://github.com/yourusername/claudia.git
cd claudia
bun install
```

### Build standalone binary

```bash
bun run build
# Creates ./claudia binary
```

## Usage

### CLI Commands

#### Task Management

```bash
# Create a task
claudia task create --title "Implement feature X" --priority p1

# List all tasks
claudia task list

# Show a specific task
claudia task show <task-id>

# Update a task
claudia task update <task-id> --title "New title" --priority p0

# Delete a task
claudia task delete <task-id> --force

# Transition task status
claudia task transition <task-id> --to in_progress

# Show available transitions
claudia task transitions <task-id>
```

#### Task Hierarchy

```bash
# Create a child task
claudia task create --title "Subtask" --parent <parent-id>

# View task tree
claudia task tree <task-id>

# View full task tree
claudia task tree
```

#### Task Context (Agent Memory)

```bash
# Set context (overwrites existing)
claudia task context-set <task-id> '{"key": "value"}'

# Get context
claudia task context-get <task-id>

# Merge context (deep merge)
claudia task context-merge <task-id> '{"additional": "data"}'
```

#### Task Dependencies

```bash
# Add dependency (task depends on another)
claudia task depends <task-id> --on <blocker-id>

# Remove dependency
claudia task undepends <task-id> --on <blocker-id>

# Show dependencies
claudia task deps <task-id>

# List blocked tasks
claudia task blocked

# List ready tasks (all deps satisfied)
claudia task ready
```

#### Sprints

```bash
# Create a sprint
claudia sprint create --name "Sprint 1" --start 2024-01-15 --end 2024-01-29

# List sprints
claudia sprint list

# Show sprint with tasks
claudia sprint show <sprint-id>

# Activate a sprint
claudia sprint activate <sprint-id>

# Show active sprint
claudia sprint active
```

#### Projects

Claudia supports multiple projects. Tasks and sprints are automatically scoped to the current project.

```bash
# Create a project
claudia project create --name "My Project" --path /path/to/project

# List projects
claudia project list

# Select a project
claudia project select <project-id>

# Show current project
claudia project current

# Auto-detect project from directory
claudia project detect --cwd /path/to/project
```

When a project is selected:
- New tasks/sprints are automatically assigned to that project
- `task list`, `sprint list`, `task tree` filter by current project
- Project can be auto-detected from working directory path

#### Database

```bash
# Initialize database
claudia db init

# Show database path
claudia db path

# Backup database
claudia db backup
```

### MCP Server

Start the MCP server for use with Claude Code or other MCP clients:

```bash
claudia mcp
```

#### Claude Code Configuration

**Option 1: Project-specific** - Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "claudia": {
      "command": "/path/to/claudia",
      "args": ["mcp"]
    }
  }
}
```

**Option 2: Global** - Add to `~/.claude.json` under `projects."/your/project".mcpServers`:

```json
{
  "mcpServers": {
    "claudia": {
      "command": "/path/to/claudia",
      "args": ["mcp"]
    }
  }
}
```

**Using with Bun (without building):**

```json
{
  "mcpServers": {
    "claudia": {
      "command": "/Users/yourname/.bun/bin/bun",
      "args": ["run", "/path/to/claudia/src/mcp/server.ts"],
      "cwd": "/path/to/claudia"
    }
  }
}
```

> **Note**: After adding the config, restart Claude Code for the MCP server to connect.

#### Project Auto-Detection

When the MCP server starts, it automatically detects or creates a project based on the current working directory:

1. **Add `.mcp.json` to your project directory** (see above)
2. **Start Claude Code in that directory**
3. The MCP server will:
   - **Auto-detect** if a project with that path already exists
   - **Auto-create** a new project (using the directory name) if none exists

All tasks and sprints are automatically assigned to the current project. No manual setup required!

#### Available MCP Tools

| Tool | Description |
|------|-------------|
| `project_create` | Create a new project |
| `project_list` | List all projects |
| `project_read` | Get project by ID |
| `project_update` | Update project fields |
| `project_delete` | Delete a project |
| `project_select` | Select working project |
| `project_current` | Get current project context |
| `task_create` | Create a new task |
| `task_read` | Get task by ID |
| `task_update` | Update task fields |
| `task_delete` | Delete a task |
| `task_list` | Query tasks with filters |
| `task_transition` | Change task status |
| `task_context_set` | Set task context |
| `task_context_get` | Get task context |
| `task_context_merge` | Merge into task context |
| `task_tree` | Get hierarchical task view |
| `task_create_many` | Bulk create tasks |
| `task_update_many` | Bulk update tasks |
| `task_transition_many` | Bulk transition tasks |
| `task_dependency_add` | Add task dependency |
| `task_dependency_remove` | Remove task dependency |
| `task_dependencies` | Get task dependencies |
| `task_blocked` | List blocked tasks |
| `task_ready` | List ready tasks |
| `task_claim` | Atomically claim a task for an agent |
| `task_release` | Release a claimed task |
| `sprint_create` | Create a sprint |
| `sprint_list` | List sprints |
| `sprint_show` | Get sprint details |
| `sprint_update` | Update sprint |
| `sprint_delete` | Delete sprint |
| `sprint_activate` | Set active sprint |

### Output Formats

All commands support multiple output formats:

```bash
# JSON (default)
claudia task list --format json

# YAML
claudia task list --format yaml

# Human-readable text
claudia task list --format text
```

## Task Status Workflow

```
┌─────────┐     ┌─────────────┐     ┌───────────┐
│ pending │────▶│ in_progress │────▶│ completed │
└─────────┘     └─────────────┘     └───────────┘
     │                │                    │
     │                │                    │
     ▼                ▼                    ▼
┌─────────┐     ┌──────────┐
│ blocked │     │ archived │ (terminal)
└─────────┘     └──────────┘
```

Valid transitions:
- `pending` → `in_progress`, `blocked`, `archived`
- `in_progress` → `pending`, `completed`, `blocked`, `archived`
- `blocked` → `pending`, `in_progress`, `archived`
- `completed` → `in_progress`, `archived`
- `archived` → (none - terminal state)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDIA_DB` | Database file path | `~/.claudia/tasks.db` |

## Development

### Run in development mode

```bash
bun run dev
```

### Run tests

```bash
bun test
```

### Type checking

```bash
bun run typecheck
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Resource not found |
| 3 | Conflict (e.g., version mismatch) |
| 4 | Validation error |
| 5 | Storage error |

## Multi-Agent Coordination

Claudia is designed to support multiple AI agents working on the same project simultaneously. This section describes patterns for effective multi-agent coordination.

### Database Concurrency

Claudia uses SQLite with WAL (Write-Ahead Logging) mode, enabling multiple agents to read and write concurrently without blocking each other.

### Task Claiming

Use `task_claim` to reserve a task for your agent before starting work:

```typescript
// Agent claims a task
const result = await task_claim({
  task_id: "uuid-of-task",
  agent_id: "agent-1"  // Your unique agent identifier
});

if (result.success) {
  // Task is now yours - proceed with work
  await task_transition({ id: task_id, to: "in_progress" });
} else {
  // Another agent already claimed it
  console.log(result.message); // "Task already claimed by agent: agent-2"
}
```

When done or if you can't complete the task:

```typescript
// Release the task for others
await task_release({ task_id: "uuid", agent_id: "agent-1" });
```

### Optimistic Locking

For concurrent updates, use the `version` field to detect conflicts:

```typescript
// Read the task first
const task = await task_read({ id: "uuid" });

// Update with version check
try {
  await task_update({
    id: task.id,
    title: "Updated title",
    version: task.version  // Pass current version
  });
} catch (error) {
  if (error.code === 3) {  // CONFLICT
    // Another agent modified the task - re-read and retry
  }
}
```

### Workflow Enforcement

Agents must follow the state machine - you cannot skip states:

```typescript
// CORRECT: pending -> in_progress -> completed
await task_transition({ id, to: "in_progress" });
// ... do work ...
await task_transition({ id, to: "completed" });

// INCORRECT: This will fail with validation error
await task_transition({ id, to: "completed" }); // Error: Cannot transition from pending to completed
```

### Recommended Multi-Agent Pattern

1. **List ready tasks**: `task_ready` returns tasks with all dependencies satisfied
2. **Claim a task**: `task_claim` atomically reserves the task
3. **Start work**: `task_transition` to `in_progress`
4. **Store progress**: Use `task_context_merge` to save state
5. **Complete**: `task_transition` to `completed`
6. **On failure**: `task_release` to let another agent take over

```typescript
// Example multi-agent workflow
const readyTasks = await task_ready();
for (const task of readyTasks) {
  const claim = await task_claim({ task_id: task.id, agent_id: myAgentId });
  if (claim.success) {
    await task_transition({ id: task.id, to: "in_progress" });

    try {
      // Do the work, saving progress as you go
      await task_context_merge({ id: task.id, context: { progress: "50%" } });

      // Complete the work
      await task_transition({ id: task.id, to: "completed" });
    } catch (error) {
      // Release so another agent can try
      await task_release({ task_id: task.id, agent_id: myAgentId });
    }
    break; // Work on one task at a time
  }
}
```

### Error Handling

When concurrent modifications occur, Claudia returns helpful error messages:

- **Version mismatch**: "Version mismatch: expected 2, got 3. Task was modified by another process. Re-read the task and retry with the current version."
- **Already claimed**: "Task already claimed by agent: agent-2"
- **Concurrent modification**: "Concurrent modification detected. Another agent updated this task. Re-read the task and retry."

Always handle exit code 3 (CONFLICT) by re-reading the task and retrying your operation.

## License

MIT
