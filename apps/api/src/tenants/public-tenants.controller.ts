import { Body, Controller, Get, Post } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import type { CreateTenantPayload } from './tenants.types';

@Controller('public/tenants')
export class PublicTenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('plans')
  getPublicPlans() {
    return this.tenantsService.getPublicPlans();
  }

  @Get('metrics')
  getPublicMetrics() {
    return this.tenantsService.getPublicMetrics();
  }

  @Post('trial')
  createTrialTenant(@Body() body: CreateTenantPayload) {
    return this.tenantsService.createTenant({
      churchName: body.churchName,
      domain: body.domain,
      plan: body.plan ?? 'Pro',
      adminEmail: body.adminEmail,
      branchName: body.branchName,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      country: body.country,
      timezone: body.timezone,
      currency: body.currency,
      denomination: body.denomination,
      sizeRange: body.sizeRange,
    });
  }
}
