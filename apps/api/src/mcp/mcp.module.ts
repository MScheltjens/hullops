import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';

/**
 * The MCP server (epic #39). Tools import the existing services, never
 * Prisma directly, so they follow the same rules as the GraphQL API.
 */
@Module({
  controllers: [McpController],
})
export class McpModule {}
