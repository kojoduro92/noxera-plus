import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@UseGuards(SuperAdminGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogsService.listAuditLogs({
      page,
      limit,
      tenantId,
      action,
      from,
      to,
      search,
    });
  }

  @Get('tenant/:tenantId')
  async getAuditLogsByTenant(
    @Param('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogsService.listAuditLogsByTenant(tenantId, { page, limit });
  }

  @Get(':id')
  async getAuditLogById(@Param('id') id: string) {
    return this.auditLogsService.getAuditLogById(id);
  }
}
