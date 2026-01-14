# Changelog

All notable changes to Claudia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-14

### Added

- **Core Task Management**
  - Create, read, update, delete tasks
  - Hierarchical parent-child task relationships
  - Task tree visualization
  - Task status workflow with validation (pending → in_progress → verification → completed)
  - Priority levels (p0-p3)
  - Tags and assignee fields

- **Acceptance Criteria & Verification**
  - Define acceptance criteria on tasks
  - Verification status for tracking criteria completion
  - `task_verify` and `task_verification_status` MCP tools

- **Dependencies**
  - Task dependency tracking (blocked-by relationships)
  - Automatic cycle detection
  - `task_blocked` and `task_ready` queries

- **Multi-Agent Coordination**
  - Atomic task claiming (`task_claim`)
  - Task release (`task_release`)
  - Optimistic locking with version field
  - Conflict detection and error messages
  - Task handoff between agents
  - Task abandonment with reason tracking

- **Sprints**
  - Sprint creation with date ranges
  - Sprint status workflow (planning → active → completed)
  - Task assignment to sprints
  - Sprint activation

- **Projects**
  - Multi-project support
  - Project auto-detection from working directory
  - Project-scoped task and sprint filtering

- **Context Storage**
  - 64KB JSON context per task
  - Set, get, and merge operations
  - Agent memory persistence

- **MCP Server**
  - Full MCP protocol implementation
  - 40+ tools for task management
  - Compound operations (task_start, task_finish, task_workspace)
  - Bulk operations (create_many, update_many, transition_many)

- **Web Dashboard**
  - Kanban board view for tasks
  - Sprint cards view
  - Project filtering
  - Clear completed tasks action
  - Auto-refresh

- **CLI**
  - Full command-line interface
  - JSON, YAML, and text output formats
  - Database initialization and backup

### Technical

- Built with Bun runtime
- SQLite database with WAL mode
- TypeScript with Zod validation
- Compiles to standalone binary
