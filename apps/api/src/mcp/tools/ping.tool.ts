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
      // TODO 1: is there anything the caller has to pass? (Look at how the
      // SDK's README example declares `inputSchema`, and decide if ping needs one.)
      annotations: { readOnlyHint: true },
    },
    async () => {
      // TODO 2: return the answer. A tool returns `{ content: [...] }`, a
      // list of content blocks; text is `{ type: 'text', text: '...' }`.
      void user;
      throw new Error('ping is not implemented yet');
    },
  );
}
