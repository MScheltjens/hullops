import { McpServer } from '@modelcontextprotocol/server';
import type { AuthUser } from '../auth/auth-context';
import { registerPingTool } from './tools/ping.tool';

/**
 * The HullOps MCP server for one request and one user.
 *
 * Stateless, like the MCP spec since 2026-07-28: every request gets a fresh
 * server, built for the user who sent it. A tool therefore never has to look
 * up who is calling; it receives the user when it's registered and applies
 * the same rules as the GraphQL resolvers (see docs/adr/0002).
 */
export function createHullOpsMcpServer(user: AuthUser): McpServer {
  const server = new McpServer(
    { name: 'hullops', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  registerPingTool(server, user);
  return server;
}
