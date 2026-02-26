import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { Permissions } from '../roles/permissions.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { UsersService } from './users.service';

type InviteUserBody = {
  email: string;
  name: string;
  roleId: string;
  branchScopeMode?: 'ALL' | 'RESTRICTED';
  branchIds?: string[];
  defaultBranchId?: string;
};

type UpdateUserBody = {
  name?: string;
  status?: 'Invited' | 'Active' | 'Suspended';
  roleId?: string;
  branchScopeMode?: 'ALL' | 'RESTRICTED';
  branchIds?: string[];
  defaultBranchId?: string | null;
};

@UseGuards(AdminGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.manage')
  async getUsers(
    @Req() request: RequestWithAuth,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('roleId') roleId?: string,
  ) {
    return this.usersService.listTenantUsers(request.authContext!.tenantId!, {
      page,
      limit,
      search,
      status,
      roleId,
    });
  }

  @Post('invite')
  @Permissions('users.manage')
  async inviteUser(@Req() request: RequestWithAuth, @Body() body: InviteUserBody) {
    return this.usersService.inviteUser(
      request.authContext!.tenantId!,
      body,
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }

  @Patch(':id')
  @Permissions('users.manage')
  async updateUser(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: UpdateUserBody,
  ) {
    return this.usersService.updateUser(
      request.authContext!.tenantId!,
      id,
      body,
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }

  @Patch(':id/role')
  @Permissions('users.manage')
  async updateRole(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { roleId: string },
  ) {
    return this.usersService.updateUserRole(
      request.authContext!.tenantId!,
      id,
      body.roleId,
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }

  @Patch(':id/branches')
  @Permissions('users.manage')
  async updateBranches(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { branchScopeMode: 'ALL' | 'RESTRICTED'; branchIds?: string[] },
  ) {
    return this.usersService.updateUserBranches(
      request.authContext!.tenantId!,
      id,
      body.branchScopeMode,
      body.branchIds ?? [],
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }

  @Post(':id/resend-invite')
  @Permissions('users.manage')
  async resendInvite(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.usersService.resendInvite(
      request.authContext!.tenantId!,
      id,
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }

  @Post(':id/suspend')
  @Permissions('users.manage')
  async suspendUser(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.usersService.suspendUser(
      request.authContext!.tenantId!,
      id,
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }

  @Post(':id/reactivate')
  @Permissions('users.manage')
  async reactivateUser(@Req() request: RequestWithAuth, @Param('id') id: string) {
    return this.usersService.reactivateUser(
      request.authContext!.tenantId!,
      id,
      request.authContext!.email ?? 'unknown',
      request.authContext!.userId ?? undefined,
    );
  }
}
