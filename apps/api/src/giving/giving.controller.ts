import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GivingService } from './giving.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

@UseGuards(AdminGuard)
@Controller("giving")
export class GivingController {
  constructor(private readonly givingService: GivingService) {}

  @Post()
  async createGivingRecord(
    @Req() request: RequestWithAuth,
    @Body() body: { amount: number; fund: string; method: string; donorName?: string; memberId?: string; transactionDate?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.givingService.createGivingRecord(
      session.tenantId!,
      { ...body, branchId: scope.branchId },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Post("online")
  async createOnlineGivingSession(
    @Req() request: RequestWithAuth,
    @Body() body: { amount: number; fund: string; memberId?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const branchScope = resolveWriteBranchScope(session, body.branchId);
    const tenantId = session.tenantId!;
    // In a real app, this would integrate with a payment gateway (e.g., Stripe) to create a checkout session.
    // For MVP, we will simulate a transaction ID and mark it as pending.
    const simulatedTransactionId = `txn_${Date.now()}`;
    const givingRecord = await this.givingService.createGivingRecord(tenantId, {
      ...body,
      branchId: branchScope.branchId,
      method: "Online",
      paymentGateway: "Stripe", // Example
      transactionId: simulatedTransactionId,
      status: "Pending", // Awaiting webhook confirmation
    }, session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined);

    return { checkoutUrl: `/checkout?transactionId=${simulatedTransactionId}`, givingRecord };
  }

  @Get()
  async getGivingRecords(@Req() request: RequestWithAuth, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.givingService.getGivingRecords(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get("summary")
  async getGivingSummary(@Req() request: RequestWithAuth, @Query("branchId") branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.givingService.getGivingSummary(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
