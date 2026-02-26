import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@UseGuards(SuperAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('overview')
  async getOverview() {
    return this.usersService.getPlatformOverview();
  }

  @Get('users')
  async getPlatformUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('provider') provider?: string,
    @Query('roleId') roleId?: string,
  ) {
    return this.usersService.listPlatformUsers({
      page,
      limit,
      search,
      status,
      tenantId,
      provider,
      roleId,
    });
  }

  @Get('users/:id')
  async getPlatformUserById(@Param('id') id: string) {
    return this.usersService.getPlatformUserById(id);
  }

  @Patch('users/:id/status')
  async updatePlatformUserStatus(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { status: 'Invited' | 'Active' | 'Suspended' },
  ) {
    return this.usersService.platformUpdateStatus(id, body.status, request.superAdmin?.email ?? 'unknown');
  }

  @Patch('users/:id/role')
  async updatePlatformUserRole(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { roleId: string },
  ) {
    return this.usersService.platformUpdateRole(id, body.roleId, request.superAdmin?.email ?? 'unknown');
  }

  @Patch('users/:id/tenant')
  async transferPlatformUserTenant(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { tenantId: string },
  ) {
    return this.usersService.platformTransferTenant(id, body.tenantId, request.superAdmin?.email ?? 'unknown');
  }

  @Post('users/:id/reset-access')
  async resetPlatformUserAccess(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.usersService.platformResetAccess(id, request.superAdmin?.email ?? 'unknown');
  }

  @Get('roles')
  async getPlatformRoles(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.rolesService.listGlobalRoles({ page, limit, search });
  }

  @Get('notifications')
  async getPlatformNotifications(
    @Req() request: RequestWithAuth,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listPlatformNotifications(
      { email: request.superAdmin?.email ?? null },
      { page, limit, severity, unreadOnly },
    );
  }

  @Patch('notifications/read-all')
  async markAllPlatformNotificationsRead(@Req() request: RequestWithAuth) {
    return this.notificationsService.markAllPlatformNotificationsRead({ email: request.superAdmin?.email ?? null });
  }

  @Patch('notifications/:id/read')
  async markPlatformNotificationRead(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.notificationsService.markPlatformNotificationRead({ email: request.superAdmin?.email ?? null }, id);
  }
}
