import { Body, Controller, Get, Header, Param, Post, Req } from '@nestjs/common';
import { WebsiteService } from './website.service';
import type { Request } from 'express';

@Controller('public/website')
export class PublicWebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get(':domain')
  async getPublicWebsite(@Param('domain') domain: string) {
    return this.websiteService.getWebsiteByDomain(domain);
  }

  @Get(':domain/sitemap.xml')
  @Header('content-type', 'application/xml; charset=utf-8')
  async getPublicSitemap(@Param('domain') domain: string) {
    return this.websiteService.getWebsiteSitemapXml(domain);
  }

  @Get(':domain/robots.txt')
  @Header('content-type', 'text/plain; charset=utf-8')
  async getPublicRobots(@Param('domain') domain: string) {
    return this.websiteService.getWebsiteRobotsTxt(domain);
  }

  @Get('preview/:token')
  async getPreviewWebsite(@Param('token') token: string) {
    return this.websiteService.getWebsitePreviewByToken(token);
  }

  @Post(':domain/forms/:formKey/submit')
  async submitForm(
    @Req() request: Request,
    @Param('domain') domain: string,
    @Param('formKey') formKey: string,
    @Body() payload: { fields: Record<string, unknown>; sourcePath?: string },
  ) {
    return this.websiteService.submitFormByDomain(
      domain,
      formKey,
      payload,
      request.ip,
      request.headers['user-agent'],
    );
  }

  @Post(':domain/analytics')
  async trackAnalytics(
    @Req() request: Request,
    @Param('domain') domain: string,
    @Body() payload: {
      pagePath: string;
      eventType: 'page_view' | 'cta_click' | 'form_submit';
      source?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    return this.websiteService.trackAnalyticsByDomain(
      domain,
      payload,
      request.ip,
      request.headers['user-agent'],
    );
  }
}
