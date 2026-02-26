import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationJobsService } from './notification-jobs.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationJobsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
