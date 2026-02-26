import { Controller, Post, Get, Put, Delete, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // Middleware or Guards should extract Tenant ID from the authenticated user's session
  // For MVP prototyping without full JWT interceptors, we can accept it via Headers
  private getTenantId(headers: any) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new UnauthorizedException('Missing x-tenant-id header');
    return tenantId;
  }

  @Post()
  async createMember(
    @Headers() headers: any,
    @Body() body: { firstName: string; lastName: string; email?: string; phone?: string; status?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.membersService.createMember(tenantId, body);
  }

  @Get()
  async getMembers(@Headers() headers: any) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"]; // Optional branchId from header
    return this.membersService.getMembers(tenantId, branchId);
  }

  @Get(':id')
  async getMemberById(@Headers() headers: any, @Param("id") id: string) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"]; // Optional branchId from header
    return this.membersService.getMemberById(id, tenantId, branchId);
  }

  @Put(':id')
  async updateMember(
    @Headers() headers: any,
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; email?: string; phone?: string; status?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"]; // Optional branchId from header
    return this.membersService.updateMember(id, tenantId, { ...body, branchId });
  }

  @Delete(':id')
  async deleteMember(@Headers() headers: any, @Param('id') id: string) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"]; // Optional branchId from header
    return this.membersService.deleteMember(id, tenantId, branchId);
  }
}
