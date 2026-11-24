import type { McpServer } from '@modelcontextprotocol/server';
import type { AuthUser } from '../../auth/auth-context';

/**
 * `ping`: checks the connection and shows who the server thinks you are.
 * The answer is `pong: <name> (<role>)`, e.g. `pong: Lena Hoffmann
 * (PROJECT_LEAD)`.
 */
export function registerPingTool(server: McpServer, user: AuthUser): void {
  server.registerTool(
    'ping',
    {
      description:
        'Checks the connection to HullOps and returns the name and role of the logged-in user.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      return {
        content: [{ type: 'text', text: `pong: ${user.name} (${user.role})` }],
      };
    },
  );
}
