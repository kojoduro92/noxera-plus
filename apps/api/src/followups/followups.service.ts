import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowupsService {
  constructor(private prisma: PrismaService) {}

  private async assertBranchInTenant(tenantId: string, branchId?: string) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found for this tenant');
  }

  private assertAllowedBranchAccess(allowedBranchIds: string[] | undefined, branchId?: string) {
    if (!allowedBranchIds || !branchId) return;
    if (!allowedBranchIds.includes(branchId)) {
      throw new NotFoundException('Branch not found for this account scope');
    }
  }

  async createFollowUp(tenantId: string, data: { memberId: string; type: string; notes?: string; dueDate?: string; assignedTo?: string; branchId?: string }, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, data.branchId);
    await this.assertBranchInTenant(tenantId, data.branchId);
    const member = await this.prisma.member.findFirst({
      where: { id: data.memberId, tenantId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found for this tenant');

    return this.prisma.followUp.create({
      data: {
        tenantId,
        branchId: data.branchId,
        memberId: data.memberId,
        type: data.type,
        notes: data.notes,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedTo: data.assignedTo,
        status: 'Pending'
      },
    });
  }

  async getFollowUps(tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.prisma.followUp.findMany({
      where,
      include: {
        member: { select: { firstName: true, lastName: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateFollowUpStatus(tenantId: string, id: string, status: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const followUp = await this.prisma.followUp.findFirst({ where });
    if (!followUp) throw new NotFoundException('Follow up not found');

    return this.prisma.followUp.update({
      where: { id },
      data: { status },
    });
  }
}
