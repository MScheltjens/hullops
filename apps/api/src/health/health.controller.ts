import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `GET /health`, for load balancers, container orchestrators and uptime
 * checks. It's plain REST rather than GraphQL because those tools expect a
 * simple URL and an HTTP status: 200 when healthy, 503 when not.
 */
// Public: monitors check it without logging in.
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      // Log the cause, but don't expose database details in the response.
      this.logger.error('Database health check failed', error);
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return { status: 'ok', database: 'up' };
  }
}
