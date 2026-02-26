import { Controller, Get, Post, Put, Body, Param, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { FollowupsService } from './followups.service';

@Controller("followups")
export class FollowupsController {
  constructor(private readonly followupsService: FollowupsService) {}

  private getTenantId(headers: any) {
    const tenantId = headers["x-tenant-id"];
    if (!tenantId) throw new UnauthorizedException("Missing x-tenant-id header");
    return tenantId;
  }

  @Post()
  async createFollowUp(
    @Headers() headers: any,
    @Body() body: { memberId: string; type: string; notes?: string; dueDate?: string; assignedTo?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.followupsService.createFollowUp(tenantId, body);
  }

  @Get()
  async getFollowUps(@Headers() headers: any, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.followupsService.getFollowUps(tenantId, branchId);
  }

  @Put(":id/status")
  async updateFollowUpStatus(
    @Headers() headers: any,
    @Param("id") id: string,
    @Body() body: { status: string },
    @Query("branchId") branchId?: string,
  ) {
    const tenantId = this.getTenantId(headers);
    return this.followupsService.updateFollowUpStatus(tenantId, id, body.status, branchId);
  }
}
