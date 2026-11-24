import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, runId } from './auth-helpers';

/**
 * The MCP endpoint, through the official MCP client: the same code Claude
 * Code and other clients use, over real HTTP against a listening app.
 */
describe('MCP server (e2e)', () => {
  let app: INestApplication<App>;
  let url: URL;
  let token: string;
  const id = `mcp-${runId()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    // A real port, because the MCP client speaks HTTP, not supertest.
    await app.listen(0);
    url = new URL('/mcp', await app.getUrl());
    token = await createUserAndLogin(app, {
      id,
      role: 'PROJECT_LEAD',
      serviceTypes: ['CLEANING'],
    });
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { id } });
    await app.close();
  });

  /** A client logged in with the given bearer token. */
  async function connect(bearer: string): Promise<Client> {
    const client = new Client({ name: 'hullops-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(url, {
        authProvider: { token: async () => bearer },
      }),
    );
    return client;
  }

  it('refuses a request without a token with 401', () => {
    return request(app.getHttpServer())
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      .expect(401);
  });

  it('refuses an invalid token with 401', () => {
    return request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      .expect(401);
  });

  it('lists the ping tool as read-only', async () => {
    const client = await connect(token);
    const { tools } = await client.listTools();
    expect(tools).toContainEqual(
      expect.objectContaining({
        name: 'ping',
        annotations: expect.objectContaining({ readOnlyHint: true }),
      }),
    );
    await client.close();
  });

  it('ping answers with the logged-in user', async () => {
    const client = await connect(token);
    const result = await client.callTool({ name: 'ping', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([
      { type: 'text', text: `pong: ${id} (PROJECT_LEAD)` },
    ]);
    await client.close();
  });
});
