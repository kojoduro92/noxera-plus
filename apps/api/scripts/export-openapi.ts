import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/noxera_plus?schema=public';
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = 'noxera-plus';
  }

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Noxera Plus API')
    .setDescription('Noxera Plus platform APIs for super-admin, admin, and public onboarding.')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputDir = join(process.cwd(), 'openapi');
  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');

  await app.close();
  process.stdout.write(`OpenAPI spec exported to ${outputPath}\n`);
}

void exportOpenApi();
