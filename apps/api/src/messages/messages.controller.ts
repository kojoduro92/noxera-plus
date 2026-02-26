import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

@UseGuards(AdminGuard)
@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async createMessage(
    @Req() request: RequestWithAuth,
    @Body() body: { type: string; audience: string; subject?: string; body: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.messagesService.createMessage(
      session.tenantId!,
      { ...body, branchId: scope.branchId },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Get()
  async getMessages(@Req() request: RequestWithAuth, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.messagesService.getMessages(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get(":id")
  async getMessageById(@Req() request: RequestWithAuth, @Param("id") id: string, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.messagesService.getMessageById(
      session.tenantId!,
      id,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Put(":id/send")
  async sendMessage(@Req() request: RequestWithAuth, @Param("id") id: string, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.messagesService.sendMessage(
      session.tenantId!,
      id,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Put(":id/status")
  async updateMessageStatus(
    @Req() request: RequestWithAuth,
    @Param("id") id: string,
    @Body() body: { status: string },
    @Query("branchId") branchId?: string,
  ) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.messagesService.updateMessageStatus(
      session.tenantId!,
      id,
      body.status,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
