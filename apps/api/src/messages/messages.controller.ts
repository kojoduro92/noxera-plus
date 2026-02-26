import { Controller, Get, Post, Put, Body, Param, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  private getTenantId(headers: any) {
    const tenantId = headers["x-tenant-id"];
    if (!tenantId) throw new UnauthorizedException("Missing x-tenant-id header");
    return tenantId;
  }

  @Post()
  async createMessage(
    @Headers() headers: any,
    @Body() body: { type: string; audience: string; subject?: string; body: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.messagesService.createMessage(tenantId, body);
  }

  @Get()
  async getMessages(@Headers() headers: any, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.messagesService.getMessages(tenantId, branchId);
  }

  @Get(":id")
  async getMessageById(@Headers() headers: any, @Param("id") id: string, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.messagesService.getMessageById(tenantId, id, branchId);
  }

  @Put(":id/send")
  async sendMessage(@Headers() headers: any, @Param("id") id: string, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.messagesService.sendMessage(tenantId, id, branchId);
  }

  @Put(":id/status")
  async updateMessageStatus(
    @Headers() headers: any,
    @Param("id") id: string,
    @Body() body: { status: string },
    @Query("branchId") branchId?: string,
  ) {
    const tenantId = this.getTenantId(headers);
    return this.messagesService.updateMessageStatus(tenantId, id, body.status, branchId);
  }
}
