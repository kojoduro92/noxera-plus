import { Controller, Get, Post, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { BranchesService } from './branches.service';

@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  private getTenantId(headers: any) {
    const tenantId = headers["x-tenant-id"];
    if (!tenantId) throw new UnauthorizedException("Missing x-tenant-id header");
    return tenantId;
  }

  @Post()
  async createBranch(@Headers() headers: any, @Body() body: { name: string; location?: string }) {
    const tenantId = this.getTenantId(headers);
    return this.branchesService.createBranch(tenantId, body);
  }

  @Get()
  async getBranches(@Headers() headers: any) {
    const tenantId = this.getTenantId(headers);
    return this.branchesService.getBranches(tenantId);
  }

  @Get(":id")
  async getBranchById(@Headers() headers: any, @Param("id") id: string) {
    const tenantId = this.getTenantId(headers);
    return this.branchesService.getBranchById(tenantId, id);
  }
}
