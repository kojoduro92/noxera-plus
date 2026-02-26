import { Module } from '@nestjs/common';
import { WebsiteService } from './website.service';
import { WebsiteController } from './website.controller';
import { PublicWebsiteController } from './public-website.controller';

@Module({
  providers: [WebsiteService],
  controllers: [WebsiteController, PublicWebsiteController]
})
export class WebsiteModule {}
