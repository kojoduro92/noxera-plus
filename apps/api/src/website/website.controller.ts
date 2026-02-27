import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { WebsiteService } from './website.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import type { WebsiteBlock } from './website-templates';

@UseGuards(AdminGuard)
@Controller('website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get()
  async getWebsite(@Req() request: RequestWithAuth) {
    return this.websiteService.getWebsite(request.authContext!.tenantId!);
  }

  @Get('templates')
  async getTemplates() {
    return this.websiteService.getTemplates();
  }

  @Post('templates/:templateKey/apply')
  async applyTemplate(@Req() request: RequestWithAuth, @Param('templateKey') templateKey: string) {
    return this.websiteService.applyTemplate(request.authContext!.tenantId!, templateKey, request.authContext?.email);
  }

  @Put('theme')
  async updateTheme(@Req() request: RequestWithAuth, @Body() themeConfig: Record<string, unknown>) {
    return this.websiteService.updateTheme(request.authContext!.tenantId!, themeConfig, request.authContext?.email);
  }

  @Get('seo')
  async getGlobalSeo(@Req() request: RequestWithAuth) {
    return this.websiteService.getGlobalSeoSettings(request.authContext!.tenantId!);
  }

  @Put('seo')
  async updateGlobalSeo(@Req() request: RequestWithAuth, @Body() payload: Record<string, unknown>) {
    return this.websiteService.updateGlobalSeoSettings(request.authContext!.tenantId!, payload, request.authContext?.email);
  }

  @Get('pages')
  async getPages(@Req() request: RequestWithAuth) {
    const website = await this.websiteService.getWebsite(request.authContext!.tenantId!);
    return website.pages;
  }

  @Post('pages')
  async createPage(@Req() request: RequestWithAuth, @Body() data: { slug: string; title: string }) {
    return this.websiteService.createPage(request.authContext!.tenantId!, data, request.authContext?.email);
  }

  @Put('pages/:id')
  async updatePage(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() data: { title?: string; isPublished?: boolean },
  ) {
    return this.websiteService.updatePage(request.authContext!.tenantId!, id, data);
  }

  @Post('pages/:id/sections')
  async addSection(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() data: { type: string; content: Record<string, unknown>; order: number },
  ) {
    return this.websiteService.addSection(request.authContext!.tenantId!, id, data);
  }

  @Get('pages/:id/revisions')
  async getPageRevisions(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.getPageRevisions(request.authContext!.tenantId!, id);
  }

  @Put('pages/:id/draft')
  async savePageDraft(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body()
    payload: {
      title?: string;
      content: { blocks: WebsiteBlock[] };
      seo?: Record<string, unknown>;
      changeSummary?: string;
    },
  ) {
    return this.websiteService.savePageDraft(request.authContext!.tenantId!, id, {
      ...payload,
      actorEmail: request.authContext?.email,
    });
  }

  @Post('pages/:id/publish')
  async publishPage(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.publishPage(request.authContext!.tenantId!, id, request.authContext?.email);
  }

  @Post('pages/:id/rollback')
  async rollbackPage(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() payload: { revisionId?: string | null },
  ) {
    return this.websiteService.rollbackPage(request.authContext!.tenantId!, id, payload.revisionId ?? null, request.authContext?.email);
  }

  @Post('preview-token')
  async createPreviewToken(@Req() request: RequestWithAuth) {
    return this.websiteService.createPreviewToken(request.authContext!.tenantId!, request.authContext?.email);
  }

  @Get('assets')
  async getAssets(@Req() request: RequestWithAuth) {
    return this.websiteService.getAssets(request.authContext!.tenantId!);
  }

  @Post('assets')
  async createAsset(
    @Req() request: RequestWithAuth,
    @Body()
    payload: {
      name: string;
      url: string;
      storageKey?: string;
      mimeType?: string;
      fileSizeBytes?: number;
      altText?: string;
    },
  ) {
    return this.websiteService.createAsset(request.authContext!.tenantId!, {
      ...payload,
      actorEmail: request.authContext?.email,
    });
  }

  @Delete('assets/:id')
  async deleteAsset(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.deleteAsset(request.authContext!.tenantId!, id);
  }

  @Post('fragments/validate')
  async validateFragment(@Body() payload: { html: string }) {
    return this.websiteService.validateHtmlFragment(payload.html ?? '');
  }

  @Get('forms')
  async getForms(@Req() request: RequestWithAuth) {
    return this.websiteService.getForms(request.authContext!.tenantId!);
  }

  @Post('forms')
  async createForm(
    @Req() request: RequestWithAuth,
    @Body() payload: { key: string; name: string; schema: Record<string, unknown>; notificationConfig?: Record<string, unknown> },
  ) {
    return this.websiteService.createForm(request.authContext!.tenantId!, {
      ...payload,
      actorEmail: request.authContext?.email,
    });
  }

  @Get('form-submissions')
  async getFormSubmissions(
    @Req() request: RequestWithAuth,
    @Query('status') status?: string,
    @Query('formKey') formKey?: string,
    @Query('limit') limit?: string,
  ) {
    return this.websiteService.getFormSubmissions(request.authContext!.tenantId!, {
      status,
      formKey,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Put('form-submissions/:id/status')
  async updateFormSubmissionStatus(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() payload: { status: string },
  ) {
    return this.websiteService.updateFormSubmissionStatus(
      request.authContext!.tenantId!,
      id,
      payload.status ?? '',
      request.authContext?.email,
    );
  }

  @Get('analytics')
  async getAnalytics(@Req() request: RequestWithAuth, @Query('range') range?: string) {
    return this.websiteService.getWebsiteAnalytics(request.authContext!.tenantId!, range);
  }

  @Post('domains/verify')
  async verifyDomain(@Req() request: RequestWithAuth, @Body() payload: { hostname: string }) {
    return this.websiteService.verifyDomain(request.authContext!.tenantId!, payload.hostname);
  }

  @Get('domains')
  async getDomains(@Req() request: RequestWithAuth) {
    return this.websiteService.getDomains(request.authContext!.tenantId!);
  }

  @Get('domains/health')
  async getDomainHealth(@Req() request: RequestWithAuth) {
    return this.websiteService.getDomainHealth(request.authContext!.tenantId!);
  }

  @Post('domains/:id/check')
  async checkDomain(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.checkDomain(request.authContext!.tenantId!, id);
  }

  @Post('domains/:id/retry')
  async retryDomain(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.retryDomainCheck(request.authContext!.tenantId!, id);
  }

  @Post('domains/:id/set-primary')
  async setPrimaryDomain(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.setPrimaryDomain(request.authContext!.tenantId!, id);
  }

  @Put('domains/:id/routing')
  async updateDomainRouting(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body()
    payload: {
      redirectToCanonical?: boolean;
      canonicalUrl?: string | null;
    },
  ) {
    return this.websiteService.updateDomainRouting(
      request.authContext!.tenantId!,
      id,
      payload,
      request.authContext?.email,
    );
  }

  @Delete('domains/:id')
  async deleteDomain(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.websiteService.deleteDomain(request.authContext!.tenantId!, id);
  }
}
