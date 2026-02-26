import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { WebsiteService } from './website.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';

@UseGuards(AdminGuard)
@Controller('website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get()
  async getWebsite(@Req() request: RequestWithAuth) {
    return this.websiteService.getWebsite(request.authContext!.tenantId!);
  }

  @Put('theme')
  async updateTheme(@Req() request: RequestWithAuth, @Body() themeConfig: any) {
    return this.websiteService.updateTheme(request.authContext!.tenantId!, themeConfig);
  }

  @Post('pages')
  async createPage(@Req() request: RequestWithAuth, @Body() data: { slug: string; title: string }) {
    return this.websiteService.createPage(request.authContext!.tenantId!, data);
  }

  @Put('pages/:id')
  async updatePage(@Req() request: RequestWithAuth, @Param('id') id: string, @Body() data: { title?: string; isPublished?: boolean }) {
    return this.websiteService.updatePage(request.authContext!.tenantId!, id, data);
  }

  @Post('pages/:id/sections')
  async addSection(@Req() request: RequestWithAuth, @Param('id') id: string, @Body() data: { type: string; content: any; order: number }) {
    return this.websiteService.addSection(request.authContext!.tenantId!, id, data);
  }
}
