import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  // Hosts route traffic to a port; when a deploy answers "failed to respond",
  // this line shows whether the API is up and on which port.
  new Logger('Bootstrap').log(`API listening on port ${port}`);
}
void bootstrap();
