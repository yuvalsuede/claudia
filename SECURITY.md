# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Claudia, please report it responsibly.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers directly
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Updates**: We will keep you informed of our progress
- **Resolution**: We aim to resolve critical issues within 7 days
- **Credit**: We will credit reporters in the release notes (unless you prefer anonymity)

### Scope

The following are in scope for security reports:

- SQL injection vulnerabilities
- Authentication/authorization bypasses
- Data exposure risks
- Command injection
- Path traversal attacks
- Denial of service vulnerabilities

### Out of Scope

- Issues in dependencies (please report to the dependency maintainers)
- Issues requiring physical access to the user's machine
- Social engineering attacks
- Issues in third-party MCP clients

## Security Best Practices

When using Claudia:

1. **Database Security**: The SQLite database (`~/.claudia/tasks.db`) contains your task data. Ensure appropriate file permissions.

2. **MCP Server**: When running as an MCP server, Claudia communicates via stdio. Ensure your MCP client is trusted.

3. **Context Storage**: Task context can store up to 64KB of JSON data. Avoid storing sensitive credentials in task context.

4. **Multi-Agent**: When using multi-agent features, ensure agent IDs are properly scoped to prevent unauthorized task claiming.

## Security Updates

Security updates will be released as patch versions (e.g., 0.1.1, 0.1.2) and announced in:

- GitHub Releases
- CHANGELOG.md
- npm package updates

We recommend always using the latest version.
