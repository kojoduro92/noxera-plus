import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminGuard } from './admin.guard';
import { RolesGuard } from '../roles/roles.guard';

@Global()
@Module({
  providers: [AuthService, SuperAdminGuard, AdminGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, SuperAdminGuard, AdminGuard, RolesGuard],
})
export class AuthModule {}
