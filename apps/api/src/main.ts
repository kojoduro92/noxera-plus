import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/noxera_plus?schema=public';
    console.warn('DATABASE_URL not set. Using local Postgres default.');
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = 'noxera-plus';
  }

  if (!process.env.SUPER_ADMIN_EMAILS) {
    process.env.SUPER_ADMIN_EMAILS = 'kojoduro92@gmail.com,superadmin@noxera.plus';
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }

  const app = await NestFactory.create(AppModule);
  // Enable CORS for frontend
  app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
