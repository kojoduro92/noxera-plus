import { Controller, Get } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('public/platform')
export class PublicPlatformController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get('profile')
  async getPublicPlatformProfile() {
    return this.platformSettingsService.getPublicPlatformProfile();
  }
}
