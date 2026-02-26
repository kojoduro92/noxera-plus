import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { RolesGuard } from '../roles/roles.guard';
import { Permissions } from '../roles/permissions.decorator';

@UseGuards(AdminGuard, RolesGuard)
@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Permissions('branches.manage')
  async createBranch(@Req() request: RequestWithAuth, @Body() body: { name: string; location?: string }) {
    return this.branchesService.createBranch(request.authContext!.tenantId!, body, {
      email: request.authContext!.email,
      userId: request.authContext!.userId,
    });
  }

  @Get()
  async getBranches(@Req() request: RequestWithAuth, @Query('includeArchived') includeArchived?: string) {
    return this.branchesService.getBranches(
      request.authContext!.tenantId!,
      includeArchived === '1' || includeArchived?.toLowerCase() === 'true',
    );
  }

  @Get(":id")
  async getBranchById(@Req() request: RequestWithAuth, @Param("id") id: string) {
    return this.branchesService.getBranchById(request.authContext!.tenantId!, id);
  }

  @Patch(":id")
  @Permissions('branches.manage')
  async updateBranch(
    @Req() request: RequestWithAuth,
    @Param("id") id: string,
    @Body() body: { name?: string; location?: string },
  ) {
    return this.branchesService.updateBranch(request.authContext!.tenantId!, id, body, {
      email: request.authContext!.email,
      userId: request.authContext!.userId,
    });
  }

  @Post(":id/archive")
  @Permissions('branches.manage')
  async archiveBranch(@Req() request: RequestWithAuth, @Param("id") id: string) {
    return this.branchesService.archiveBranch(request.authContext!.tenantId!, id, {
      email: request.authContext!.email,
      userId: request.authContext!.userId,
    });
  }

  @Post(":id/unarchive")
  @Permissions('branches.manage')
  async unarchiveBranch(@Req() request: RequestWithAuth, @Param("id") id: string) {
    return this.branchesService.unarchiveBranch(request.authContext!.tenantId!, id, {
      email: request.authContext!.email,
      userId: request.authContext!.userId,
    });
  }

  @Get(":id/stats")
  async getBranchStats(@Req() request: RequestWithAuth, @Param("id") id: string) {
    return this.branchesService.getBranchStats(request.authContext!.tenantId!, id);
  }
}
