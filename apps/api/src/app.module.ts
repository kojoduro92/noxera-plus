import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { AttendanceModule } from './attendance/attendance.module';
import { GivingModule } from './giving/giving.module';
import { GroupsModule } from './groups/groups.module';
import { EventsModule } from './events/events.module';
import { FollowupsModule } from './followups/followups.module';
import { MessagesModule } from './messages/messages.module';
import { BranchesModule } from './branches/branches.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WebsiteModule } from './website/website.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AuthModule, PrismaModule, TenantsModule, MembersModule, ServicesModule, AttendanceModule, GivingModule, GroupsModule, EventsModule, FollowupsModule, MessagesModule, BranchesModule, IntegrationsModule, WebsiteModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
