import { Controller, Get, Post, Body, Param, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  private getTenantId(headers: any) {
    const tenantId = headers["x-tenant-id"];
    if (!tenantId) throw new UnauthorizedException("Missing x-tenant-id header");
    return tenantId;
  }

  @Post()
  async createEvent(
    @Headers() headers: any,
    @Body() body: { title: string; description?: string; startDate: string; endDate: string; location?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.eventsService.createEvent(tenantId, body);
  }

  @Get()
  async getEvents(@Headers() headers: any, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.eventsService.getEvents(tenantId, branchId);
  }

  @Get(":id")
  async getEventById(@Headers() headers: any, @Param("id") id: string, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.eventsService.getEventById(tenantId, id, branchId);
  }
}
