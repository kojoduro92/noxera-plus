import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { Permissions } from './permissions.decorator';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';

@UseGuards(AdminGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async getRoles(@Req() request: RequestWithAuth, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.rolesService.listTenantRoles(request.authContext!.tenantId!, { page, limit, search });
  }

  @Get('permissions-catalog')
  getPermissionsCatalog() {
    return this.rolesService.getPermissionCatalog();
  }

  @Post()
  @Permissions('roles.manage')
  async createRole(
    @Req() request: RequestWithAuth,
    @Body() body: { name: string; permissions: string[] },
  ) {
    return this.rolesService.createRole(request.authContext!.tenantId!, body);
  }

  @Patch(':id')
  @Permissions('roles.manage')
  async updateRole(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: { name?: string; permissions?: string[] },
  ) {
    return this.rolesService.updateRole(request.authContext!.tenantId!, id, body);
  }

  @Delete(':id')
  @Permissions('roles.manage')
  async deleteRole(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Query('reassignRoleId') reassignRoleId?: string,
  ) {
    return this.rolesService.deleteRole(request.authContext!.tenantId!, id, reassignRoleId);
  }
}
