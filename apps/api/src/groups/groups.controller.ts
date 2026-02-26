import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

@UseGuards(AdminGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  async createGroup(
    @Req() request: RequestWithAuth,
    @Body() body: { name: string; type: string; description?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.groupsService.createGroup(
      session.tenantId!,
      { ...body, branchId: scope.branchId },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Get()
  async getGroups(@Req() request: RequestWithAuth, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.groupsService.getGroups(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get(':id')
  async getGroupById(@Req() request: RequestWithAuth, @Param('id') id: string, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.groupsService.getGroupById(
      session.tenantId!,
      id,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Post(':id/members')
  async addMemberToGroup(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { memberId: string, role?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.groupsService.addMemberToGroup(
      session.tenantId!,
      id,
      body.memberId,
      body.role,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }
}
