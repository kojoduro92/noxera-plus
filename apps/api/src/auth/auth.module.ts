import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  providers: [AuthService, SuperAdminGuard],
  controllers: [AuthController],
  exports: [AuthService, SuperAdminGuard],
})
export class AuthModule {}
