import { Controller, Get, Post, Body, Param, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  private getTenantId(headers: any) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new UnauthorizedException('Missing x-tenant-id header');
    return tenantId;
  }

  @Post()
  async createGroup(
    @Headers() headers: any,
    @Body() body: { name: string; type: string; description?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.groupsService.createGroup(tenantId, body);
  }

  @Get()
  async getGroups(@Headers() headers: any, @Query('branchId') branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.groupsService.getGroups(tenantId, branchId);
  }

  @Get(':id')
  async getGroupById(@Headers() headers: any, @Param('id') id: string, @Query('branchId') branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.groupsService.getGroupById(tenantId, id, branchId);
  }

  @Post(':id/members')
  async addMemberToGroup(
    @Headers() headers: any,
    @Param('id') id: string,
    @Body() body: { memberId: string, role?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"]; // Optional branchId from header for context
    return this.groupsService.addMemberToGroup(tenantId, id, body.memberId, body.role, branchId);
  }
}
