import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AuditLogsController, BillingController, SupportController],
  providers: [AuditLogsService, BillingService, SupportService],
})
export class AdminModule {}
