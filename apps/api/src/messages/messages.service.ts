import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
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

  async createMessage(tenantId: string, data: { type: string; audience: string; subject?: string; body: string; branchId?: string }, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, data.branchId);
    await this.assertBranchInTenant(tenantId, data.branchId);
    return this.prisma.message.create({
      data: {
        tenantId,
        branchId: data.branchId,
        type: data.type,
        audience: data.audience,
        subject: data.subject,
        body: data.body,
        status: 'Draft', // Initially a draft
      },
    });
  }

  async getMessages(tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMessageById(tenantId: string, id: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const message = await this.prisma.message.findFirst({ where });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async updateMessageStatus(tenantId: string, id: string, status: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const message = await this.prisma.message.findFirst({ where });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id },
      data: { status },
    });
  }

  async sendMessage(tenantId: string, id: string, branchId?: string, allowedBranchIds?: string[]) {
    // In a real app, this would integrate with an external SMS/Email provider
    // For MVP, we'll just update the status to 'Sent' and record sentAt
    const message = await this.updateMessageStatus(tenantId, id, 'Sent', branchId, allowedBranchIds);
    // Simulate sending time
    return this.prisma.message.update({
      where: { id: message.id },
      data: { sentAt: new Date() },
    });
  }
}
