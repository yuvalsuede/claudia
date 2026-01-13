# Claudia

A CLI task manager designed for AI agents, with full MCP (Model Context Protocol) server support.

## Features

- **Task Management**: Create, read, update, delete tasks with hierarchical parent-child relationships
- **State Machine**: Validated status transitions (pending → in_progress → completed)
- **Dependencies**: Track task dependencies with automatic cycle detection
- **Sprints**: Group tasks into sprints for organized work periods
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

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "claudia": {
      "command": "claudia",
      "args": ["mcp"]
    }
  }
}
```

#### Available MCP Tools

| Tool | Description |
|------|-------------|
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

## License

MIT
