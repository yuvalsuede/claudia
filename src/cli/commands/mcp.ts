import { Command } from "commander";
import { startMcpServer } from "../../mcp/server.js";

export function createMcpCommand(): Command {
  const mcp = new Command("mcp")
    .description("Start MCP server for Claude integration")
    .action(async () => {
      await startMcpServer();
    });

  return mcp;
}
