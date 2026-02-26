import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';
import { PrismaService } from './prisma/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function runTenantIsolationStartupReport(prisma: PrismaService) {
  const [unlinkedAdmins, inconsistentBranchAssignments] = await Promise.all([
    prisma.user.findMany({
      where: {
        isSuperAdmin: false,
        tenantId: null,
      },
      select: {
        id: true,
        email: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: {
        isSuperAdmin: false,
        tenantId: { not: null },
        branchId: { not: null },
      },
      select: {
        id: true,
        email: true,
        tenantId: true,
        branch: {
          select: {
            id: true,
            tenantId: true,
          },
        },
      },
      take: 100,
    }),
  ]);

  const crossTenantBranchUsers = inconsistentBranchAssignments.filter(
    (user) => user.branch && user.tenantId !== user.branch.tenantId,
  );

  if (unlinkedAdmins.length > 0) {
    const sampleEmails = unlinkedAdmins.map((user) => user.email).join(', ');
    console.warn(
      `[tenant-isolation] Found ${unlinkedAdmins.length} unlinked non-super-admin users. Access will be blocked until mapped. Sample: ${sampleEmails}`,
    );
  } else {
    console.log('[tenant-isolation] No unlinked non-super-admin users found.');
  }

  if (crossTenantBranchUsers.length > 0) {
    const sample = crossTenantBranchUsers
      .slice(0, 5)
      .map(
        (user) =>
          `${user.email} (userTenant=${user.tenantId}, branchTenant=${user.branch?.tenantId})`,
      )
      .join(', ');
    console.warn(
      `[tenant-isolation] Found ${crossTenantBranchUsers.length} users assigned to branches in another tenant. Sample: ${sample}`,
    );
  } else {
    console.log('[tenant-isolation] No cross-tenant branch assignments found.');
  }
}

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://postgres:password@localhost:5432/noxera_plus?schema=public';
    console.warn('DATABASE_URL not set. Using local Postgres default.');
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = 'noxera-plus';
  }

  if (!process.env.SUPER_ADMIN_EMAILS) {
    process.env.SUPER_ADMIN_EMAILS =
      'kojoduro92@gmail.com,superadmin@noxera.plus';
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }

  const app = await NestFactory.create(AppModule);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Noxera Plus API')
    .setDescription('Noxera Plus platform APIs for super-admin, admin, and public onboarding.')
    .setVersion('1.0.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, openApiDocument, {
    jsonDocumentUrl: '/docs/openapi.json',
  });
  const prisma = app.get(PrismaService);
  await runTenantIsolationStartupReport(prisma);
  // Enable CORS for frontend
  app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
