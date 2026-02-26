import { Body, Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { BillingService } from './billing.service';

type SuperAdminRequest = {
  superAdmin?: {
    email?: string;
  };
};

@Controller('billing')
@UseGuards(SuperAdminGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Get('tenants')
  async getTenantBilling(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('planId') planId?: string,
    @Query('search') search?: string,
  ) {
    return this.billingService.listTenantBilling({
      page,
      limit,
      status,
      planId,
      search,
    });
  }

  @Patch('tenants/:id/plan')
  async updateTenantPlan(
    @Param('id') tenantId: string,
    @Req() request: SuperAdminRequest,
    @Body() body: { planId?: string; planName?: string },
  ) {
    return this.billingService.updateTenantPlan(tenantId, body, request.superAdmin?.email ?? 'unknown');
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') tenantId: string,
    @Req() request: SuperAdminRequest,
    @Body() body: { status: string },
  ) {
    return this.billingService.updateTenantStatus(tenantId, body, request.superAdmin?.email ?? 'unknown');
  }
}
