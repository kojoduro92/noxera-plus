import { Module } from '@nestjs/common';
import { GivingService } from './giving.service';
import { GivingController } from './giving.controller';

@Module({
  providers: [GivingService],
  controllers: [GivingController]
})
export class GivingModule {}
