import { Module } from '@nestjs/common';
import { FollowupsService } from './followups.service';
import { FollowupsController } from './followups.controller';

@Module({
  providers: [FollowupsService],
  controllers: [FollowupsController]
})
export class FollowupsModule {}
