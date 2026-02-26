import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope } from '../auth/branch-scope';
import { Permissions } from '../roles/permissions.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { ReportsService } from './reports.service';

@UseGuards(AdminGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('members')
  @Permissions('reports.view')
  async getMembersGrowth(
    @Req() request: RequestWithAuth,
    @Query('branchId') branchId?: string,
    @Query('rangeDays') rangeDays?: string,
  ) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.reportsService.getMembersGrowthReport(
      session.tenantId!,
      scope.branchId,
      rangeDays,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get('attendance')
  @Permissions('reports.view')
  async getAttendanceTrend(
    @Req() request: RequestWithAuth,
    @Query('branchId') branchId?: string,
    @Query('rangeDays') rangeDays?: string,
  ) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.reportsService.getAttendanceTrendReport(
      session.tenantId!,
      scope.branchId,
      rangeDays,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get('giving')
  @Permissions('reports.view')
  async getGivingSummary(
    @Req() request: RequestWithAuth,
    @Query('branchId') branchId?: string,
    @Query('rangeDays') rangeDays?: string,
  ) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.reportsService.getGivingSummaryReport(
      session.tenantId!,
      scope.branchId,
      rangeDays,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get('groups')
  @Permissions('reports.view')
  async getGroupEngagement(@Req() request: RequestWithAuth, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.reportsService.getGroupEngagementReport(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
