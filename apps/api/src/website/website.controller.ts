import { Controller, Get, Post, Put, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { WebsiteService } from './website.service';

@Controller('website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  private getTenantId(headers: any) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new UnauthorizedException('Missing x-tenant-id header');
    return tenantId;
  }

  @Get()
  async getWebsite(@Headers() headers: any) {
    return this.websiteService.getWebsite(this.getTenantId(headers));
  }

  @Put('theme')
  async updateTheme(@Headers() headers: any, @Body() themeConfig: any) {
    return this.websiteService.updateTheme(this.getTenantId(headers), themeConfig);
  }

  @Post('pages')
  async createPage(@Headers() headers: any, @Body() data: { slug: string; title: string }) {
    return this.websiteService.createPage(this.getTenantId(headers), data);
  }

  @Put('pages/:id')
  async updatePage(@Headers() headers: any, @Param('id') id: string, @Body() data: { title?: string; isPublished?: boolean }) {
    return this.websiteService.updatePage(id, data);
  }

  @Post('pages/:id/sections')
  async addSection(@Headers() headers: any, @Param('id') id: string, @Body() data: { type: string; content: any; order: number }) {
    return this.websiteService.addSection(id, data);
  }
}
