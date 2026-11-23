import {
  All,
  Controller,
  Logger,
  OnModuleDestroy,
  Req,
  Res,
} from '@nestjs/common';
import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  type AuthInfo,
  createMcpHandler,
  type McpRequestContext,
} from '@modelcontextprotocol/server';
import type { Response } from 'express';
import {
  type AuthRequest,
  type AuthUser,
  CurrentUser,
} from '../auth/auth-context';
import { createHullOpsMcpServer } from './mcp-server';

/**
 * `/mcp`: the MCP endpoint over Streamable HTTP (see docs/adr/0002).
 *
 * Not @Public(), so the global AuthGuard has already checked the bearer
 * token before a request gets here, exactly as for GraphQL. Without a valid
 * token the client gets a 401 and no MCP code runs.
 *
 * The SDK speaks web-standard Request/Response; `toNodeHandler` adapts it to
 * Express's req/res. `@Res()` hands the response to the SDK, so Nest doesn't
 * write one of its own.
 */
@Controller('mcp')
export class McpController implements OnModuleDestroy {
  private readonly logger = new Logger(McpController.name);

  // One handler for all requests; it builds a server per request from the
  // factory. `legacy: 'stateless'` (the default) also serves clients that
  // still speak the 2025 protocol, one request at a time.
  private readonly handler = createMcpHandler(
    (ctx) => createHullOpsMcpServer(userFrom(ctx)),
    { onerror: (error) => this.logger.error(error) },
  );

  private readonly serve = toNodeHandler(this.handler, {
    onerror: (error) => this.logger.error(error),
  });

  @All()
  async handle(
    @Req() req: AuthRequest,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    // The SDK passes `authInfo` through to the factory untouched; it does no
    // token checks of its own. The user rides along in `extra`.
    const auth: AuthInfo = {
      token: '',
      clientId: user.id,
      scopes: [],
      extra: { user },
    };
    // Nest has already parsed the JSON body, so the adapter can't read the
    // stream again: hand it the parsed body.
    await this.serve(Object.assign(req, { auth }), res, req.body as unknown);
  }

  async onModuleDestroy(): Promise<void> {
    await this.handler.close();
  }
}

/** The user the controller attached to this request. */
function userFrom(ctx: McpRequestContext): AuthUser {
  const user = ctx.authInfo?.extra?.user as AuthUser | undefined;
  // Can't happen behind the AuthGuard; failing loudly beats serving a
  // request without knowing whose rights apply.
  if (!user) throw new Error('MCP request without an authenticated user');
  return user;
}
