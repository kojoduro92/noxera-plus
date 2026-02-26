import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

type MemberWritePayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  occupation?: string;
  avatarUrl?: string;
  preferredContactMethod?: string;
  membershipDate?: string;
  baptismDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  status?: string;
  tags?: string[];
  branchId?: string;
};

type MemberUpdatePayload = Partial<MemberWritePayload>;

@UseGuards(AdminGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  async createMember(
    @Req() request: RequestWithAuth,
    @Body() body: MemberWritePayload,
  ) {
    const session = request.authContext!;
    const branchScope = resolveWriteBranchScope(session, body.branchId);
    return this.membersService.createMember(session.tenantId!, {
      ...body,
      branchId: branchScope.branchId,
    });
  }

  @Get()
  async getMembers(
    @Req() request: RequestWithAuth,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const session = request.authContext!;
    const branchScope = resolveReadBranchScope(session, branchId);
    return this.membersService.getMembers(session.tenantId!, {
      branchId: branchScope.branchId,
      allowedBranchIds: session.branchScopeMode === 'RESTRICTED' ? (branchScope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
      status,
      search,
    });
  }

  @Get(':id')
  async getMemberById(@Req() request: RequestWithAuth, @Param("id") id: string, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const branchScope = resolveReadBranchScope(session, branchId);
    return this.membersService.getMemberById(
      id,
      session.tenantId!,
      branchScope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (branchScope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Put(':id')
  async updateMember(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: MemberUpdatePayload,
  ) {
    const session = request.authContext!;
    const writeScope = resolveWriteBranchScope(session, body.branchId);
    return this.membersService.updateMember(
      id,
      session.tenantId!,
      {
        ...body,
        branchId: writeScope.branchId ?? body.branchId,
      },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Delete(':id')
  async deleteMember(@Req() request: RequestWithAuth, @Param('id') id: string, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const branchScope = resolveReadBranchScope(session, branchId);
    return this.membersService.deleteMember(
      id,
      session.tenantId!,
      branchScope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (branchScope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
