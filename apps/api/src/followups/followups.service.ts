import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowupsService {
  constructor(private prisma: PrismaService) {}

  async createFollowUp(tenantId: string, data: { memberId: string; type: string; notes?: string; dueDate?: string; assignedTo?: string; branchId?: string }) {
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

  async getFollowUps(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.followUp.findMany({
      where,
      include: {
        member: { select: { firstName: true, lastName: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateFollowUpStatus(tenantId: string, id: string, status: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const followUp = await this.prisma.followUp.findFirst({ where });
    if (!followUp) throw new NotFoundException('Follow up not found');

    return this.prisma.followUp.update({
      where: { id },
      data: { status },
    });
  }
}
