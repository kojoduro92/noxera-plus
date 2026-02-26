import { Controller, Get, Param } from '@nestjs/common';
import { WebsiteService } from './website.service';

@Controller('public/website')
export class PublicWebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get(':domain')
  async getPublicWebsite(@Param('domain') domain: string) {
    return this.websiteService.getWebsiteByDomain(domain);
  }
}
