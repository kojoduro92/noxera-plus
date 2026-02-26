import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlatformController } from './platform.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';
import { PublicPlatformController } from './public-platform.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PrismaModule, UsersModule, RolesModule, NotificationsModule],
  controllers: [AuditLogsController, BillingController, SupportController, PlatformController, PlatformSettingsController, PublicPlatformController],
  providers: [AuditLogsService, BillingService, SupportService, PlatformSettingsService],
})
export class AdminModule {}
