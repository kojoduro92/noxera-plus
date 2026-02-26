import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

@UseGuards(AdminGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() request: RequestWithAuth,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listTenantNotifications(
      {
        tenantId: request.authContext!.tenantId!,
        userId: request.authContext!.userId,
        email: request.authContext!.email,
      },
      { page, limit, severity, unreadOnly },
    );
  }

  @Patch('read-all')
  async markAllAsRead(@Req() request: RequestWithAuth) {
    return this.notificationsService.markAllTenantNotificationsRead({
      tenantId: request.authContext!.tenantId!,
      userId: request.authContext!.userId,
      email: request.authContext!.email,
    });
  }

  @Patch(':id/read')
  async markAsRead(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.notificationsService.markTenantNotificationRead(
      {
        tenantId: request.authContext!.tenantId!,
        userId: request.authContext!.userId,
        email: request.authContext!.email,
      },
      id,
    );
  }
}
