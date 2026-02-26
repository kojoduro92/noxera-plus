import { Controller, Post, Get, Body, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { GivingService } from './giving.service';

@Controller("giving")
export class GivingController {
  constructor(private readonly givingService: GivingService) {}

  private getTenantId(headers: any) {
    const tenantId = headers["x-tenant-id"];
    if (!tenantId) throw new UnauthorizedException("Missing x-tenant-id header");
    return tenantId;
  }

  @Post()
  async createGivingRecord(
    @Headers() headers: any,
    @Body() body: { amount: number; fund: string; method: string; donorName?: string; memberId?: string; transactionDate?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.givingService.createGivingRecord(tenantId, body);
  }

  @Post("online")
  async createOnlineGivingSession(
    @Headers() headers: any,
    @Body() body: { amount: number; fund: string; memberId?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"]; // Optional branchId from header for context
    // In a real app, this would integrate with a payment gateway (e.g., Stripe) to create a checkout session.
    // For MVP, we will simulate a transaction ID and mark it as pending.
    const simulatedTransactionId = `txn_${Date.now()}`;
    const givingRecord = await this.givingService.createGivingRecord(tenantId, {
      ...body,
      branchId,
      method: "Online",
      paymentGateway: "Stripe", // Example
      transactionId: simulatedTransactionId,
      status: "Pending", // Awaiting webhook confirmation
    });

    return { checkoutUrl: `/checkout?transactionId=${simulatedTransactionId}`, givingRecord };
  }

  @Get()
  async getGivingRecords(@Headers() headers: any, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.givingService.getGivingRecords(tenantId, branchId);
  }

  @Get("summary")
  async getGivingSummary(@Headers() headers: any, @Query("branchId") branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.givingService.getGivingSummary(tenantId, branchId);
  }
}
