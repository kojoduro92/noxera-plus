import { Body, Controller, Get, Patch, Query, Param, Req, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { PlatformSettingsService } from './platform-settings.service';

@UseGuards(SuperAdminGuard)
@Controller('settings')
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get('platform')
  async getPlatformSettings() {
    return this.platformSettingsService.getPlatformSettings();
  }

  @Patch('platform')
  async updatePlatformSettings(
    @Req() request: RequestWithAuth,
    @Body()
    body: {
      platformProfile?: Record<string, unknown>;
      authAccessPolicy?: Record<string, unknown>;
      billingPolicy?: Record<string, unknown>;
      auditRetention?: Record<string, unknown>;
    },
  ) {
    return this.platformSettingsService.updatePlatformSettings(body, request.superAdmin?.email);
  }

  @Get('notification-policy')
  async getNotificationPolicy() {
    return this.platformSettingsService.getNotificationPolicy();
  }

  @Patch('notification-policy')
  async updateNotificationPolicy(@Req() request: RequestWithAuth, @Body() body: Record<string, unknown>) {
    return this.platformSettingsService.updateNotificationPolicy(body, request.superAdmin?.email);
  }

  @Get('content')
  async getContentHubSettings() {
    return this.platformSettingsService.getContentHubSettings();
  }

  @Patch('content')
  async updateContentHubSettings(@Req() request: RequestWithAuth, @Body() body: Record<string, unknown>) {
    return this.platformSettingsService.updateContentHubSettings(body, request.superAdmin?.email);
  }

  @Get('system')
  async getSystemManagementSettings() {
    return this.platformSettingsService.getSystemManagementSettings();
  }

  @Patch('system')
  async updateSystemManagementSettings(@Req() request: RequestWithAuth, @Body() body: Record<string, unknown>) {
    return this.platformSettingsService.updateSystemManagementSettings(body, request.superAdmin?.email);
  }

  @Get('release-flags')
  async getReleaseFlags(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.platformSettingsService.listReleaseFlags({ page, limit, search });
  }

  @Patch('release-flags/:key')
  async updateReleaseFlag(
    @Req() request: RequestWithAuth,
    @Param('key') key: string,
    @Body() body: { enabled?: boolean; rolloutStage?: string; description?: string | null; owner?: string | null; tenantCohort?: string[] },
  ) {
    return this.platformSettingsService.updateReleaseFlag(key, body, request.superAdmin?.email);
  }
}
