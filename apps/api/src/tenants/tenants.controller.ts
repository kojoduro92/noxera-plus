
import { Controller, Post, Get, Body, Param, Put, Req, UseGuards, NotFoundException, BadRequestException, Query } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { AuthService } from '../auth/auth.service';
import type { RequestWithAuth } from '../auth/auth.types';
import type { CreateTenantPayload } from './tenants.types';

@Controller('tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async createTenant(@Body() body: CreateTenantPayload) {
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

  @Get('platform/activation-funnel')
  async getActivationFunnel() {
    return this.tenantsService.getActivationFunnel();
  }

  @Post(':id/impersonate')
  async impersonateTenant(@Param('id') id: string, @Req() request: RequestWithAuth) {
    const tenant = await this.tenantsService.getTenantById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const superAdminEmail = request.superAdmin?.email;
    if (!superAdminEmail) {
      throw new BadRequestException('Missing super-admin context for impersonation.');
    }

    const impersonation = this.authService.createImpersonationToken(superAdminEmail, id);

    await this.tenantsService.recordImpersonationAudit(id, 'IMPERSONATION_START', {
      superAdminEmail,
      startedAt: impersonation.startedAt,
      expiresAt: impersonation.expiresAt,
    });

    return {
      message: 'Impersonation session started',
      redirectUrl: `/admin?impersonation=1`,
      token: impersonation.token,
      tenantId: id,
      superAdminEmail,
      startedAt: impersonation.startedAt,
      expiresAt: impersonation.expiresAt,
    };
  }

  @Post('impersonate/stop')
  async stopImpersonation(@Body() body: { tenantId: string }, @Req() request: RequestWithAuth) {
    const tenantId = body.tenantId?.trim();
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    await this.tenantsService.recordImpersonationAudit(tenantId, 'IMPERSONATION_END', {
      superAdminEmail: request.superAdmin?.email ?? null,
      endedAt: new Date().toISOString(),
    });

    return { message: 'Impersonation session ended', tenantId };
  }

  @Get(':id/branches')
  async getTenantBranches(@Param('id') id: string) {
    return this.tenantsService.getTenantBranches(id);
  }

  @Get(':id/users')
  async getTenantUsers(@Param('id') id: string) {
    return this.tenantsService.getTenantUsers(id);
  }

  @Get(':id/roles')
  async getTenantRoles(@Param('id') id: string) {
    return this.tenantsService.getTenantRoles(id);
  }

  @Get(':id/audit-preview')
  async getTenantAuditPreview(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.tenantsService.getTenantAuditPreview(id, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }

  @Get(':id')
  async getTenantById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }

  @Put(':id/status')
  async updateTenantStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.tenantsService.updateTenantStatus(id, body.status);
  }
}
