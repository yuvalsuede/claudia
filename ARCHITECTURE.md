# Claudia - Architecture & Design Document

## Executive Summary

**Claudia** is a CLI task manager designed specifically for AI agents (Claude). It provides task tracking, sprint management, and context persistence via an MCP (Model Context Protocol) server that integrates with Claude Code, Claude Desktop, and other MCP-compatible clients.

### Core Problem
AI agents like Claude need a way to:
1. Track what they're working on across sessions
2. Break down complex work into manageable tasks
3. Coordinate with other agents (multi-agent scenarios)
4. Persist context between conversation sessions

### Current Status
- **Version:** 0.1.0
- **Stage:** Early development, functional but with workflow enforcement issues
- **Repository:** https://github.com/yuvalsuede/claudia

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Bun | Fast JS runtime, compiles to single binary |
| Language | TypeScript | Type safety |
| CLI Framework | Commander.js | Command parsing |
| Database | SQLite (better-sqlite3) | Local persistence |
| MCP SDK | @modelcontextprotocol/sdk | Claude integration |
| Validation | Zod | Schema validation |
| Output | JSON/YAML/Text | Flexible formatting |

### Why These Choices
- **Bun**: Single binary distribution, fast startup, native SQLite support
- **SQLite**: Zero configuration, portable, file-based (stored at `~/.claudia/tasks.db`)
- **MCP**: Official Anthropic protocol for tool integration with Claude

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLAUDE (AI Agent)                        │
│                                                                   │
│  Conversation Session                                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ "Help me implement user authentication"                      │ │
│  │                                                              │ │
│  │ Claude should:                                               │ │
│  │ 1. Create task via MCP                                       │ │
│  │ 2. Claim task (moves to in_progress)                         │ │
│  │ 3. Do the work                                               │ │
│  │ 4. Transition to completed                                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ MCP Protocol (stdio)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDIA MCP SERVER                        │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Task Tools  │  │Sprint Tools │  │Project Tools│              │
│  │             │  │             │  │             │              │
│  │ - create    │  │ - create    │  │ - create    │              │
│  │ - read      │  │ - list      │  │ - list      │              │
│  │ - update    │  │ - show      │  │ - select    │              │
│  │ - delete    │  │ - activate  │  │ - current   │              │
│  │ - list      │  │             │  │             │              │
│  │ - claim     │  │             │  │             │              │
│  │ - transition│  │             │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Service Layer
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          CORE SERVICES                           │
│                                                                   │
│  src/core/                                                        │
│  ├── task.ts      - Task business logic, validation              │
│  ├── sprint.ts    - Sprint management                            │
│  ├── project.ts   - Multi-project support                        │
│  └── workflow.ts  - State transition rules                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Repository Layer
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATABASE LAYER                          │
│                                                                   │
│  src/db/                                                          │
│  ├── client.ts              - SQLite connection                  │
│  ├── migrations.ts          - Schema setup                       │
│  └── repositories/                                                │
│      ├── task.repo.ts       - Task CRUD                          │
│      ├── sprint.repo.ts     - Sprint CRUD                        │
│      ├── project.repo.ts    - Project CRUD                       │
│      └── dependency.repo.ts - Task dependencies                  │
│                                                                   │
│  Storage: ~/.claudia/tasks.db                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tasks Table
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,           -- UUID
  title TEXT NOT NULL,           -- Task title (max 500 chars)
  description TEXT,              -- Detailed description (max 10KB)
  status TEXT NOT NULL DEFAULT 'pending',  -- State machine
  priority TEXT,                 -- p0, p1, p2, p3
  task_type TEXT,                -- feature, bugfix, planning, etc.
  parent_id TEXT REFERENCES tasks(id),     -- Hierarchical tasks
  sprint_id TEXT REFERENCES sprints(id),   -- Sprint grouping
  project_id TEXT REFERENCES projects(id), -- Multi-project
  due_at TEXT,                   -- ISO8601 datetime
  tags TEXT,                     -- JSON array
  assignee TEXT,                 -- Human assignee
  agent_id TEXT,                 -- AI agent that claimed this task
  estimate INTEGER,              -- Time estimate
  context TEXT,                  -- JSON blob for agent memory (max 64KB)
  metadata TEXT,                 -- Custom JSON metadata
  images TEXT,                   -- JSON array of attached images
  version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Task Types
```typescript
type TaskType =
  | "feature"     // New functionality
  | "bugfix"      // Bug fixes
  | "planning"    // Planning/design work
  | "development" // General development
  | "ui"          // UI/UX work
  | "refactor"    // Code refactoring
  | "docs"        // Documentation
  | "test"        // Testing
  | "chore";      // Maintenance tasks
```

### Task Status (State Machine)
```typescript
type TaskStatus =
  | "pending"     // Not started
  | "in_progress" // Being worked on
  | "blocked"     // Waiting on something
  | "completed"   // Done
  | "archived";   // Hidden from default views
```

### State Transitions
```
pending ──────► in_progress ──────► completed
    │               │                   │
    │               │                   │
    ▼               ▼                   ▼
 blocked ◄────► in_progress         archived
    │               │
    │               │
    ▼               ▼
 archived        blocked
```

Valid transitions:
- `pending` → `in_progress`, `blocked`, `archived`
- `in_progress` → `completed`, `blocked`, `pending`
- `blocked` → `in_progress`, `pending`, `archived`
- `completed` → `archived`, `in_progress` (reopen)

### Sprints Table
```sql
CREATE TABLE sprints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',  -- planning, active, completed, archived
  start_at TEXT,
  end_at TEXT,
  project_id TEXT REFERENCES projects(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Projects Table
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  path TEXT UNIQUE,              -- Directory path for auto-detection
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Task Dependencies Table
```sql
CREATE TABLE task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  depends_on_id TEXT NOT NULL REFERENCES tasks(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_id)
);
```

---

## CLI Commands

### Quick Commands (Shortcuts)
| Command | Description | Example |
|---------|-------------|---------|
| `claudia !!` | Quick add task | `claudia !! "Fix bug"` |
| `claudia ??` | List pending tasks | `claudia ??` |
| `claudia bug` | Add bugfix task | `claudia bug "Safari crash"` |
| `claudia feat` | Add feature task | `claudia feat "Dark mode"` |
| `claudia @@` | Open web dashboard | `claudia @@` |

### Full Commands
```bash
# Task Management
claudia task create --title "Task" --priority p1 --type feature
claudia task list [--status pending,in_progress] [--priority p0,p1]
claudia task show <id>
claudia task update <id> --status in_progress
claudia task delete <id>
claudia task tree [<id>]           # Show task hierarchy
claudia task transition <id> <status>

# Sprint Management
claudia sprint create --name "Sprint 1"
claudia sprint list
claudia sprint show <id>
claudia sprint activate <id>

# Project Management
claudia project create --name "My Project" --path /path/to/project
claudia project list
claudia project select <id>

# Database
claudia db init                    # Initialize database
claudia db backup                  # Backup database

# MCP Server
claudia mcp                        # Start MCP server (for Claude)
```

---

## MCP Server Tools

The MCP server exposes these tools to Claude:

### Task Tools
| Tool | Description |
|------|-------------|
| `workflow_info` | Returns mandatory workflow rules (MUST READ FIRST) |
| `task_create` | Create a new task |
| `task_read` | Get task details |
| `task_update` | Update task fields |
| `task_delete` | Delete a task |
| `task_list` | List/filter tasks |
| `task_transition` | Change task status |
| `task_claim` | **CRITICAL**: Claim task and move to in_progress |
| `task_release` | Release a claimed task |
| `task_tree` | Get hierarchical view |
| `task_ready` | List tasks ready to work on |
| `task_blocked` | List blocked tasks |

### Bulk Operations
| Tool | Description |
|------|-------------|
| `task_create_many` | Create multiple tasks (max 100) |
| `task_update_many` | Update multiple tasks |
| `task_transition_many` | Transition multiple tasks |

### Context Tools (Agent Memory)
| Tool | Description |
|------|-------------|
| `task_context_set` | Store agent context on a task |
| `task_context_merge` | Merge context (deep merge) |
| `task_context_get` | Retrieve stored context |

### Sprint Tools
| Tool | Description |
|------|-------------|
| `sprint_create` | Create sprint |
| `sprint_list` | List sprints |
| `sprint_show` | Show sprint details |
| `sprint_update` | Update sprint |
| `sprint_activate` | Set active sprint |

### Project Tools
| Tool | Description |
|------|-------------|
| `project_create` | Create project |
| `project_list` | List projects |
| `project_select` | Select working project |
| `project_current` | Get current project |

---

## Intended Workflow

### The Problem We're Trying to Solve

When Claude works on tasks, we want to track:
1. **What** is being worked on
2. **When** work started (in_progress)
3. **When** work finished (completed)
4. **Context** that can persist across sessions

### Expected Workflow

```
User: "Help me implement user authentication"

Claude SHOULD:
1. task_list() - See existing tasks
2. task_create({title: "Implement user auth", type: "feature"}) - Create task
3. task_claim(task_id, agent_id) - Claim and move to in_progress ← CRITICAL
4. [Do the actual work]
5. task_transition(task_id, "completed") - Mark done
```

### Current Reality (THE PROBLEM)

```
User: "Help me implement user authentication"

Claude ACTUALLY DOES:
1. [Immediately starts coding]
2. [Finishes work]
3. [Session ends]

Result: No task tracking, nothing in Claudia
```

---

## CRITICAL ISSUES

### Issue #1: Agents Ignore Workflow (MAJOR)

**Problem**: Claude agents do not consistently use task_claim or task_transition. They simply do the work without updating task status.

**Evidence**: Dashboard shows 0 tasks "In Progress" despite active work.

**Attempted Solutions**:
1. Updated tool descriptions to say "CRITICAL" and "MUST"
2. Added `workflow_info` tool at top of tool list
3. Added `_workflow_reminder` in task_list responses
4. Made task_claim auto-transition to in_progress

**Result**: Agents still skip the workflow.

**Root Cause**: MCP tool descriptions are suggestions, not enforcement. Claude optimizes for completing the user's request, not for following Claudia's workflow.

### Issue #2: No Enforcement Mechanism

**Problem**: Tools don't REFUSE to work if workflow isn't followed. There's no gate-keeping.

**Potential Solutions**:

#### Solution A: Enforce at Tool Level
```typescript
// Example: task_update refuses if not claimed
case "task_update": {
  const task = getTask(input.id);
  if (task.status !== "in_progress") {
    throw new Error("WORKFLOW ERROR: You must call task_claim first!");
  }
  // ... proceed with update
}
```

Pros: Hard enforcement
Cons: Might break legitimate use cases

#### Solution B: CLAUDE.md Instructions
Create `CLAUDE.md` in project root (Claude Code reads this automatically):
```markdown
# Project Instructions

## MANDATORY: Task Management with Claudia
Before ANY coding work:
1. Call task_claim to mark task as in_progress
2. After completing work, call task_transition to completed
...
```

Pros: Claude Code specifically looks for this
Cons: Still just instructions, can be ignored

#### Solution C: Claude Code Hooks
Use Claude Code's hook system to intercept:
```json
{
  "hooks": {
    "before_tool_call": "validate_claudia_workflow.sh"
  }
}
```

Pros: Hard enforcement
Cons: Complex, requires hook implementation

#### Solution D: Make Claudia the Entry Point
Instead of Claude working freely, make Claudia the orchestrator:
- User talks to Claudia
- Claudia creates tasks and assigns to Claude agents
- Claude can only work on claimed tasks

Pros: Full control
Cons: Major architectural change

### Issue #3: Agent Identity

**Problem**: No consistent agent_id across sessions. Each Claude session is independent.

**Current State**: agent_id is optional and rarely provided.

**Desired State**: Each Claude session should have a unique, persistent identifier.

### Issue #4: Session Context Loss

**Problem**: When a Claude session ends, context is lost. Even if tasks are in Claudia, Claude doesn't automatically check them in new sessions.

**Partial Solution**: task_context_set/get allows storing context, but Claude must be told to use it.

---

## File Structure

```
claudia/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI entry point, quick commands
│   │   ├── web-server.ts         # Web dashboard server
│   │   ├── formatters.ts         # Output formatting (JSON/YAML/text)
│   │   └── commands/
│   │       ├── task.ts           # Task CLI commands
│   │       ├── sprint.ts         # Sprint CLI commands
│   │       ├── project.ts        # Project CLI commands
│   │       ├── db.ts             # Database commands
│   │       └── mcp.ts            # MCP server command
│   │
│   ├── mcp/
│   │   ├── server.ts             # MCP server implementation
│   │   └── tools.ts              # Tool definitions and schemas
│   │
│   ├── core/
│   │   ├── task.ts               # Task business logic
│   │   ├── sprint.ts             # Sprint business logic
│   │   ├── project.ts            # Project business logic
│   │   └── workflow.ts           # State machine rules
│   │
│   ├── db/
│   │   ├── client.ts             # SQLite connection
│   │   ├── migrations.ts         # Schema migrations
│   │   └── repositories/
│   │       ├── task.repo.ts      # Task data access
│   │       ├── sprint.repo.ts    # Sprint data access
│   │       ├── project.repo.ts   # Project data access
│   │       └── dependency.repo.ts # Dependency data access
│   │
│   ├── schemas/
│   │   ├── task.ts               # Task Zod schemas
│   │   ├── sprint.ts             # Sprint Zod schemas
│   │   └── project.ts            # Project Zod schemas
│   │
│   └── utils/
│       ├── exit-codes.ts         # CLI exit codes
│       ├── errors.ts             # Error types
│       └── display.ts            # ANSI display utilities
│
├── package.json
├── tsconfig.json
├── bunfig.toml
└── ARCHITECTURE.md               # This document
```

---

## Configuration

### MCP Configuration (Claude Code)
Add to `~/.claude/claude_desktop_config.json`:
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

### Database Location
- Default: `~/.claudia/tasks.db`
- Created automatically on first use

---

## Web Dashboard

### Access
```bash
claudia @@
# Opens http://localhost:3333
```

### Features
- Kanban board view (Pending, In Progress, Blocked, Completed)
- Project selector dropdown
- Task cards with type badges
- Auto-refresh every 5 seconds

### API Endpoints
- `GET /` - HTML dashboard
- `GET /api/tasks?project=<id>` - JSON task list
- `GET /api/projects` - JSON project list

---

## Multi-Agent Support

### Task Claiming
```typescript
// Atomic claim - prevents race conditions
task_claim(task_id, agent_id)
// Returns: { success: true/false, task, message }
```

### Claim Rules
1. Only unclaimed tasks can be claimed
2. Claiming auto-transitions to `in_progress`
3. Only the claiming agent can release

### Multi-Agent Scenario
```
Agent A: task_claim("task-1", "agent-a") → Success, task in_progress
Agent B: task_claim("task-1", "agent-b") → Fail, "already claimed by agent-a"
Agent A: task_release("task-1", "agent-a") → Success
Agent B: task_claim("task-1", "agent-b") → Success
```

---

## Potential Architectural Changes

### Option 1: Claudia as Orchestrator
Instead of Claude having free access to tools, Claudia becomes the brain:

```
User → Claudia (orchestrator) → Claude Agent(s)
                ↓
         Task Management
```

Claudia would:
- Parse user requests
- Create and assign tasks
- Monitor agent progress
- Enforce workflow

### Option 2: Tool-Level Enforcement
Make tools refuse to work without proper workflow:

```typescript
// All task operations require claimed status
if (!isClaimedByCurrentAgent(taskId)) {
  throw new WorkflowError("Must claim task first");
}
```

### Option 3: Event-Driven Architecture
Add webhooks/events that external systems can monitor:

```
Task Created → Webhook → External System
Task Started → Webhook → Dashboard Update
Task Completed → Webhook → Notification
```

### Option 4: Integration with Claude Code Internals
Work with Anthropic to add native task tracking in Claude Code.

---

## Questions for Architect

1. **Enforcement Strategy**: Should we enforce workflow at tool level (hard) or rely on instructions (soft)?

2. **Agent Identity**: How should we handle agent_id? Auto-generate? Session-based? User-provided?

3. **Session Continuity**: How do we ensure Claude checks Claudia at the start of each session?

4. **Architecture Change**: Should Claudia become an orchestrator rather than a passive tool provider?

5. **Integration Depth**: Should we pursue deeper integration with Claude Code itself?

6. **Failure Mode**: What happens when agents don't follow the workflow? Log? Alert? Block?

7. **Multi-User**: Should Claudia support multiple human users with separate task spaces?

8. **Cloud Sync**: Should task data sync across machines or stay local?

---

## Summary

### What Works
- Task CRUD operations
- Sprint management
- Project management with auto-detection
- Hierarchical tasks with dependencies
- Context persistence
- Web dashboard
- CLI quick commands
- Multi-agent claiming

### What Doesn't Work
- **Agents don't follow workflow** - The core problem
- No enforcement mechanism
- Session identity is inconsistent
- Claude doesn't check Claudia automatically

### The Core Challenge
MCP tools are passive - they wait to be called. Claude optimizes for user satisfaction, not for tool workflows. We need either:
1. Hard enforcement (tools refuse without workflow)
2. Deeper integration (Claude Code native support)
3. Orchestration layer (Claudia controls Claude)

---

## Next Steps

1. Decide on enforcement strategy
2. Implement chosen solution
3. Test with real workflows
4. Iterate based on results

---

*Document generated: 2026-01-13*
*Version: 0.1.0*
