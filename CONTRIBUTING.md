# Contributing to Claudia

Thank you for your interest in contributing to Claudia! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/claudia.git
   cd claudia
   ```
3. **Install dependencies**:
   ```bash
   bun install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- Git

### Running Locally

```bash
# Development mode (runs from source)
bun run dev

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Type checking
bun run typecheck

# Build binary
bun run build
```

### Project Structure

```
claudia/
├── src/
│   ├── cli/           # CLI entry point and commands
│   ├── mcp/           # MCP server implementation
│   ├── core/          # Business logic
│   ├── db/            # Database layer
│   ├── schemas/       # Zod validation schemas
│   └── utils/         # Utilities and helpers
├── tests/             # Test files
└── README.md
```

## Making Changes

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and naming conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and small

### Commit Messages

Write clear, concise commit messages:

```
<type>: <description>

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat: Add task filtering by multiple tags
fix: Resolve dependency cycle detection issue
docs: Update MCP configuration examples
```

### Testing

- Write tests for new features
- Ensure existing tests pass before submitting
- Test edge cases and error conditions

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/task.test.ts

# Run with coverage
bun test --coverage
```

## Pull Request Process

1. **Update documentation** if your changes affect user-facing features
2. **Add tests** for new functionality
3. **Run the test suite** and ensure all tests pass
4. **Update the CHANGELOG.md** with your changes under "Unreleased"
5. **Submit your PR** with a clear description of changes

### PR Title Format

Use the same format as commit messages:
```
feat: Add task templates feature
fix: Handle empty sprint gracefully
```

### PR Description

Include:
- What changes you made and why
- How to test the changes
- Any breaking changes
- Related issues (use "Fixes #123" to auto-close)

## Reporting Issues

### Bug Reports

Include:
- Claudia version (`claudia --version`)
- Operating system and version
- Bun version (`bun --version`)
- Steps to reproduce
- Expected vs actual behavior
- Error messages or logs

### Feature Requests

Include:
- Clear description of the feature
- Use case / problem it solves
- Proposed implementation (optional)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?

- Open a [GitHub Discussion](https://github.com/anthropics/claudia/discussions) for questions
- Check existing issues before creating new ones

## License

By contributing to Claudia, you agree that your contributions will be licensed under the MIT License.
