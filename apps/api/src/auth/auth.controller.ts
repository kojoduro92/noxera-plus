
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('session')
  async createSession(@Body('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const session = await this.authService.resolveSession(token);

    return {
      message: 'Session valid',
      uid: session.uid,
      email: session.email,
      isSuperAdmin: session.isSuperAdmin,
      userId: session.userId,
      tenantId: session.tenantId,
      tenantName: session.tenantName,
      roleId: session.roleId,
      roleName: session.roleName,
      permissions: session.permissions,
      defaultBranchId: session.defaultBranchId,
      userStatus: session.userStatus,
      branchScopeMode: session.branchScopeMode,
      allowedBranchIds: session.allowedBranchIds,
      signInProvider: session.signInProvider,
    };
  }

  @Post('impersonation/session')
  async createImpersonationSession(@Body('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const { session, impersonation } = await this.authService.resolveImpersonationSession(token);

    return {
      message: 'Impersonation session valid',
      uid: session.uid,
      email: session.email,
      isSuperAdmin: session.isSuperAdmin,
      userId: session.userId,
      tenantId: session.tenantId,
      tenantName: session.tenantName,
      roleId: session.roleId,
      roleName: session.roleName,
      permissions: session.permissions,
      defaultBranchId: session.defaultBranchId,
      userStatus: session.userStatus,
      branchScopeMode: session.branchScopeMode,
      allowedBranchIds: session.allowedBranchIds,
      signInProvider: session.signInProvider,
      impersonation,
    };
  }
}
