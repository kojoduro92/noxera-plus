import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GivingService {
  constructor(private prisma: PrismaService) {}

  async createGivingRecord(tenantId: string, data: { amount: number; fund: string; method: string; donorName?: string; memberId?: string; transactionDate?: string; paymentGateway?: string; transactionId?: string; status?: string; branchId?: string }) {
    return this.prisma.givingTransaction.create({
      data: {
        tenantId,
        branchId: data.branchId,
        amount: data.amount,
        fund: data.fund,
        method: data.method,
        donorName: data.donorName,
        memberId: data.memberId,
        transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
        paymentGateway: data.paymentGateway,
        transactionId: data.transactionId,
        status: data.status || "Completed",
      },
    });
  }

  async getGivingRecords(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.givingTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      include: {
        member: {
          select: { firstName: true, lastName: true }
        }
      }
    });
  }

  async getGivingSummary(tenantId: string, branchId?: string) {
    const records = await this.getGivingRecords(tenantId, branchId);
    
    // Calculate simple MTD values logic
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let tithes = 0;
    let offerings = 0;
    let special = 0;

    for (const record of records) {
      const d = new Date(record.transactionDate);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (record.fund.toLowerCase().includes('tithe')) tithes += record.amount;
        else if (record.fund.toLowerCase().includes('offering')) offerings += record.amount;
        else special += record.amount;
      }
    }

    return { tithes, offerings, special };
  }
}
