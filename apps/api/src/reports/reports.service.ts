import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeDateWindow(rangeDays?: string) {
    const parsed = Number.parseInt(rangeDays ?? '30', 10);
    const safeDays = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 30;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - safeDays + 1);
    return { from, days: safeDays };
  }

  private async assertBranchInTenant(tenantId: string, branchId?: string) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({ where: { tenantId, id: branchId }, select: { id: true } });
    if (!branch) {
      throw new NotFoundException('Branch not found for this tenant');
    }
  }

  async getMembersGrowthReport(tenantId: string, branchId?: string, rangeDays?: string, allowedBranchIds?: string[]) {
    await this.assertBranchInTenant(tenantId, branchId);
    const { from, days } = this.normalizeDateWindow(rangeDays);

    const where: any = {
      tenantId,
      createdAt: { gte: from },
    };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    const members = await this.prisma.member.findMany({
      where,
      select: { id: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalsByDay = new Map<string, number>();
    let runningTotal = 0;
    for (let i = days - 1; i >= 0; i -= 1) {
      const point = new Date();
      point.setHours(0, 0, 0, 0);
      point.setDate(point.getDate() - i);
      totalsByDay.set(point.toISOString().slice(0, 10), 0);
    }

    for (const row of members) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (totalsByDay.has(key)) {
        totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + 1);
      }
      runningTotal += 1;
    }

    return {
      summary: {
        totalMembers: members.length,
        activeMembers: members.filter((member) => member.status === 'Active').length,
      },
      series: Array.from(totalsByDay.entries()).map(([date, value]) => ({ date, value })),
    };
  }

  async getAttendanceTrendReport(tenantId: string, branchId?: string, rangeDays?: string, allowedBranchIds?: string[]) {
    await this.assertBranchInTenant(tenantId, branchId);
    const { from, days } = this.normalizeDateWindow(rangeDays);

    const where: any = {
      tenantId,
      createdAt: { gte: from },
    };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    const attendances = await this.prisma.attendance.findMany({
      where,
      select: { id: true, createdAt: true, memberId: true, visitorId: true },
    });

    const points = new Map<string, { members: number; visitors: number; total: number }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const point = new Date();
      point.setHours(0, 0, 0, 0);
      point.setDate(point.getDate() - i);
      points.set(point.toISOString().slice(0, 10), { members: 0, visitors: 0, total: 0 });
    }

    for (const row of attendances) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const existing = points.get(key);
      if (!existing) continue;
      if (row.memberId) existing.members += 1;
      if (row.visitorId) existing.visitors += 1;
      existing.total += 1;
    }

    return {
      summary: {
        totalCheckIns: attendances.length,
        memberCheckIns: attendances.filter((item) => Boolean(item.memberId)).length,
        visitorCheckIns: attendances.filter((item) => Boolean(item.visitorId)).length,
      },
      series: Array.from(points.entries()).map(([date, value]) => ({ date, ...value })),
    };
  }

  async getGivingSummaryReport(tenantId: string, branchId?: string, rangeDays?: string, allowedBranchIds?: string[]) {
    await this.assertBranchInTenant(tenantId, branchId);
    const { from, days } = this.normalizeDateWindow(rangeDays);

    const where: any = {
      tenantId,
      transactionDate: { gte: from },
    };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    const transactions = await this.prisma.givingTransaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        fund: true,
        method: true,
        transactionDate: true,
      },
    });

    const totalsByDay = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const point = new Date();
      point.setHours(0, 0, 0, 0);
      point.setDate(point.getDate() - i);
      totalsByDay.set(point.toISOString().slice(0, 10), 0);
    }

    for (const transaction of transactions) {
      const key = transaction.transactionDate.toISOString().slice(0, 10);
      if (totalsByDay.has(key)) {
        totalsByDay.set(key, Number((totalsByDay.get(key)! + transaction.amount).toFixed(2)));
      }
    }

    const totalAmount = Number(transactions.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
    const byFund = transactions.reduce<Record<string, number>>((acc, row) => {
      acc[row.fund] = Number(((acc[row.fund] ?? 0) + row.amount).toFixed(2));
      return acc;
    }, {});

    return {
      summary: {
        totalAmount,
        transactionCount: transactions.length,
        byFund,
      },
      series: Array.from(totalsByDay.entries()).map(([date, amount]) => ({ date, amount })),
    };
  }

  async getGroupEngagementReport(tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    await this.assertBranchInTenant(tenantId, branchId);

    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    const groups = await this.prisma.group.findMany({
      where,
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    const totalMembers = groups.reduce((sum, group) => sum + group._count.members, 0);

    return {
      summary: {
        groupCount: groups.length,
        totalMemberships: totalMembers,
        averageMembersPerGroup: groups.length > 0 ? Number((totalMembers / groups.length).toFixed(2)) : 0,
      },
      items: groups.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        memberCount: group._count.members,
      })),
    };
  }
}
