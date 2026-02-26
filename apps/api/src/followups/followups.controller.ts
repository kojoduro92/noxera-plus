import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { FollowupsService } from './followups.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

@UseGuards(AdminGuard)
@Controller("followups")
export class FollowupsController {
  constructor(private readonly followupsService: FollowupsService) {}

  @Post()
  async createFollowUp(
    @Req() request: RequestWithAuth,
    @Body() body: { memberId: string; type: string; notes?: string; dueDate?: string; assignedTo?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.followupsService.createFollowUp(
      session.tenantId!,
      { ...body, branchId: scope.branchId },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Get()
  async getFollowUps(@Req() request: RequestWithAuth, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.followupsService.getFollowUps(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Put(":id/status")
  async updateFollowUpStatus(
    @Req() request: RequestWithAuth,
    @Param("id") id: string,
    @Body() body: { status: string },
    @Query("branchId") branchId?: string,
  ) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.followupsService.updateFollowUpStatus(
      session.tenantId!,
      id,
      body.status,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
