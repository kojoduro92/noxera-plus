import { createReadStream } from 'fs';
import { Body, Controller, Get, Patch, Post, Query, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { PlatformSettingsService } from './platform-settings.service';
import { ExportJobsRunnerService } from './export-jobs-runner.service';

@UseGuards(SuperAdminGuard)
@Controller('settings')
export class PlatformSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly exportJobsRunnerService: ExportJobsRunnerService,
  ) {}

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

  @Post('system/webhooks/:id/check')
  async runWebhookHealthCheck(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.platformSettingsService.runWebhookHealthCheck(id, request.superAdmin?.email);
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

  @Get('export-jobs')
  async getScheduledExportJobs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('dataset') dataset?: string,
  ) {
    return this.platformSettingsService.listScheduledExportJobs({ page, limit, search, status, dataset });
  }

  @Post('export-jobs')
  async createScheduledExportJob(
    @Req() request: RequestWithAuth,
    @Body()
    body: {
      name: string;
      dataset: string;
      format: string;
      cadence: string;
      recipients?: string[];
      nextRunAt?: string;
      enabled?: boolean;
      maxArtifacts?: number;
      maxRuns?: number;
    },
  ) {
    return this.platformSettingsService.createScheduledExportJob(body, request.superAdmin?.email);
  }

  @Patch('export-jobs/:id')
  async updateScheduledExportJob(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      dataset?: string;
      format?: string;
      cadence?: string;
      recipients?: string[];
      nextRunAt?: string | null;
      enabled?: boolean;
      runNow?: boolean;
      lastResult?: 'queued' | 'running' | 'success' | 'failed';
      maxArtifacts?: number;
      maxRuns?: number;
    },
  ) {
    const updated = await this.platformSettingsService.updateScheduledExportJob(id, body, request.superAdmin?.email);

    if (body.runNow) {
      return this.exportJobsRunnerService.runJobNow(id, request.superAdmin?.email);
    }

    return updated;
  }

  @Get('export-jobs/:id/artifacts')
  async getScheduledExportJobArtifacts(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.exportJobsRunnerService.listJobArtifacts(id, limit);
  }

  @Get('export-jobs/:id/history')
  async getScheduledExportJobHistory(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.exportJobsRunnerService.listJobRunHistory(id, limit);
  }

  @Get('export-jobs/:id/download-url')
  async getScheduledExportJobDownloadUrl(
    @Param('id') id: string,
    @Query('artifactId') artifactId: string | undefined,
  ) {
    return this.exportJobsRunnerService.getExportArtifactSignedUrl(id, artifactId);
  }

  @Get('export-jobs/:id/download')
  async downloadScheduledExportJobArtifact(
    @Param('id') id: string,
    @Query('artifactId') artifactId: string | undefined,
    @Res() response: Response,
  ) {
    const download = await this.exportJobsRunnerService.getExportArtifactDownload(id, artifactId);

    if (download.redirectUrl) {
      return response.redirect(302, download.redirectUrl);
    }

    if (!download.localFilePath) {
      return response.status(404).json({ message: 'Artifact file path is unavailable.', code: 'ARTIFACT_NOT_FOUND' });
    }

    response.setHeader('Content-Type', download.artifact.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${download.artifact.fileName}"`);
    response.setHeader('Content-Length', String(download.artifact.byteSize));
    createReadStream(download.localFilePath).pipe(response);
  }

  @Get('compliance/requests')
  async getComplianceRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.platformSettingsService.listComplianceRequests({ page, limit, search, status, type, tenantId });
  }

  @Post('compliance/requests')
  async createComplianceRequest(
    @Req() request: RequestWithAuth,
    @Body()
    body: {
      type: string;
      title: string;
      description?: string | null;
      tenantId?: string | null;
      tenantName?: string | null;
      requestedByEmail?: string | null;
      assigneeEmail?: string | null;
      dueAt?: string | null;
      notes?: string | null;
      status?: string;
    },
  ) {
    return this.platformSettingsService.createComplianceRequest(body, request.superAdmin?.email);
  }

  @Patch('compliance/requests/:id')
  async updateComplianceRequest(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      assigneeEmail?: string | null;
      dueAt?: string | null;
      notes?: string | null;
      title?: string;
      description?: string | null;
    },
  ) {
    return this.platformSettingsService.updateComplianceRequest(id, body, request.superAdmin?.email);
  }

  @Get('compliance/timeline')
  async getComplianceTimeline(@Query('limit') limit?: string, @Query('search') search?: string) {
    return this.platformSettingsService.getComplianceTimeline({ limit, search });
  }

  @Get('compliance/automation')
  async getComplianceAutomationPolicy() {
    return this.platformSettingsService.getComplianceAutomationPolicy();
  }

  @Patch('compliance/automation')
  async updateComplianceAutomationPolicy(
    @Req() request: RequestWithAuth,
    @Body()
    body: {
      enabled?: boolean;
      defaultSlaHours?: number;
      reminderHoursBeforeDue?: number[];
      escalationHoursAfterDue?: number[];
      escalationRecipientEmails?: string[];
    },
  ) {
    return this.platformSettingsService.updateComplianceAutomationPolicy(body, request.superAdmin?.email);
  }

  @Post('compliance/automation/run')
  async runComplianceAutomationNow(@Req() request: RequestWithAuth) {
    return this.platformSettingsService.runComplianceAutomationCycle(request.superAdmin?.email);
  }
}
