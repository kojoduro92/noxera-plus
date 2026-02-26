import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

@UseGuards(AdminGuard)
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async createEvent(
    @Req() request: RequestWithAuth,
    @Body() body: { title: string; description?: string; startDate: string; endDate: string; location?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.eventsService.createEvent(
      session.tenantId!,
      { ...body, branchId: scope.branchId },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Get()
  async getEvents(@Req() request: RequestWithAuth, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.eventsService.getEvents(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get(":id")
  async getEventById(@Req() request: RequestWithAuth, @Param("id") id: string, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.eventsService.getEventById(
      session.tenantId!,
      id,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
