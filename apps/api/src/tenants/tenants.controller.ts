
import { Controller, Post, Get, Body, Param, Put, Headers, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminGuard } from '../auth/super-admin.guard';

@Controller('tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async createTenant(
    @Body() body: { churchName: string; domain: string; plan: string; adminEmail: string; branchName?: string },
  ) {
    return this.tenantsService.createTenant(body);
  }

  @Get()
  async getTenants() {
    return this.tenantsService.getTenants();
  }

  @Get('platform/metrics')
  async getPlatformMetrics() {
    return this.tenantsService.getPlatformMetrics();
  }

  @Get(':id')
  async getTenantById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }

  @Put(':id/status')
  async updateTenantStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.tenantsService.updateTenantStatus(id, body.status);
  }

  @Post(':id/impersonate')
  async impersonateTenant(@Param('id') id: string, @Headers() headers: any) {
    // 1. Verify caller is Super Admin (Middleware should handle this, but let's be explicit for structural logic)
    // 2. Logic to generate a temporary impersonation token or session cookie
    return {
      message: 'Impersonation session started',
      redirectUrl: `/admin?impersonate=${id}`,
      token: 'temp_impersonation_token_logic_here',
    };
  }
}
