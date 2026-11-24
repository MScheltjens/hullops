# 2. MCP server: transport, authentication and where it runs

- **Status:** accepted
- **Date:** 2026-11-24
- **Issue:** #40 (epic #39, MCP server for HullOps)

## Context

An AI assistant such as Claude should be able to work with HullOps through MCP (Model Context Protocol), for example by asking "which orders on this vessel are overdue?" or by setting an order to in progress. The point is that **AI access follows the same rights as the app**. A worker's assistant sees only that worker's vessels and may do only what the worker may do.

Before any real tools are written, three things have to be decided:

1. **Transport:** how a client reaches the server. MCP has two standard transports. With **stdio**, the client starts the server as a local process. With **Streamable HTTP**, the server is a web endpoint.
2. **Authentication:** how the server knows who is calling.
3. **Where it runs:** inside the NestJS API, or as a separate app in the monorepo.

What the solution has to offer:

- **Per-user rights.** Every tool call runs as one HullOps user, with the same rules as GraphQL: roles, `visibleVesselsWhere` and `canSeeEmail`.
- **One source of truth.** Tools call the same services as the resolvers and never query Prisma directly, so a rule can't drift between the two.
- **Deployable** next to the API on Railway, and usable for the demo from Claude Code and Claude Desktop.
- **Revocable access.** A token can be withdrawn, and a deactivated user is cut off at once.
- **Little extra infrastructure** for a portfolio project.

## Decision

**Streamable HTTP, served by the NestJS API on `/mcp`.** A `McpModule` with one controller passes each request to the official MCP TypeScript SDK (v2, `createMcpHandler`) in **stateless** mode. Every request gets a fresh `McpServer` built for the user who sent it. Tools receive that user when they are registered, so they never have to look up who is calling.

**Authentication: a bearer token checked by the existing global `AuthGuard`.** `/mcp` is not `@Public()`, so the guard checks the `Authorization: Bearer …` header before any MCP code runs, exactly as it does for GraphQL. Without a valid token the client gets a 401. The guard also looks the user up on every request, so a deactivated user is refused even while their token is still valid.

- **For the spike** the token is the normal login JWT. That proved the path end to end: `claude mcp add --transport http … --header "Authorization: Bearer …"` followed by the `ping` tool answering `pong: Lena Hoffmann (PROJECT_LEAD)`.
- **For real use** each user gets **personal access tokens** (#41). They are long-lived and named ("Claude on my laptop"), and they are stored as a hash so the user can revoke them one at a time. The guard will accept a personal access token as well as a JWT, so the MCP code itself doesn't change.

**OAuth is not used for now** (see below). The token check sits behind the guard, so adding OAuth later changes how a token is issued and checked, not the tools.

## Alternatives considered

| Option | Why not |
|---|---|
| **stdio** (a local process per user) | Every user would need the code and a Node install on their own machine, plus database access or an API token anyway. It can't be deployed, so it doesn't fit a hosted app or a demo for people without a checkout. |
| **A separate MCP app** in `apps/` that calls the GraphQL API | Keeps the API untouched, but it adds a second service to deploy, and a second hop that translates MCP into GraphQL. It would either call GraphQL as the user, which duplicates the API shape in the tool code, or need its own database access, which breaks "one source of truth". Inside Nest, tools inject the same services, and `visibleVesselsWhere` applies for free. |
| **The login JWT as the permanent MCP token** | Works today, but it expires after `JWT_EXPIRES_IN_HOURS` (8 h), so the user has to paste a new one into their client every day. It also can't be revoked on its own: the only way to cut off one client is to deactivate the user. |
| **OAuth 2.1** (the MCP authorization spec) | The proper flow for public MCP servers. The client discovers the authorization server, the user logs in in a browser, and no token is ever copied by hand. But it needs an authorization server with dynamic client registration, consent screens and refresh tokens. That is a lot of work and attack surface for a demo with a handful of users. Claude Code also skips its OAuth flow as soon as an `Authorization` header is configured, so personal access tokens work with today's clients without OAuth. |
| **Stateful sessions** (`Mcp-Session-Id`) | Not needed. HullOps tools are plain request/response, and the spec is stateless since 2026-07-28. A stateless server needs no session store and scales across instances without sticky routing. |

## Consequences

- The API has a new endpoint, `/mcp`. It is covered by the global `AuthGuard` like every other endpoint, so forgetting to protect it is impossible.
- Every tool must follow the epic's rule: call the existing services, filter through `visibleVesselsWhere`, and return "nothing" or "not found" for what the user can't see, never a different error. Tool e2e tests use the official MCP client (`@modelcontextprotocol/client`) against a listening app, the same code real clients use.
- Nest's body parser has already read the request, so the controller hands the parsed body to the SDK's Node adapter (`toNodeHandler`). Changing the body parser setup can break `/mcp`, and the MCP e2e tests catch that.
- Until #41 ships, connecting a client means copying a JWT by hand, and it stops working after 8 hours. That is fine for development, but not for the demo.
- The JWT or personal access token ends up in the client's config (e.g. `~/.claude.json`). This is one reason personal access tokens must be revocable one at a time.
- Moving to OAuth later would mean an authorization server and the MCP discovery endpoints (`/.well-known/oauth-protected-resource`). The tools and the guard's "who is this user" contract stay the same.
