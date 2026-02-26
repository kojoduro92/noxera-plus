import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async createMessage(tenantId: string, data: { type: string; audience: string; subject?: string; body: string; branchId?: string }) {
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

  async getMessages(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMessageById(tenantId: string, id: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const message = await this.prisma.message.findFirst({ where });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async updateMessageStatus(tenantId: string, id: string, status: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const message = await this.prisma.message.findFirst({ where });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id },
      data: { status },
    });
  }

  async sendMessage(tenantId: string, id: string, branchId?: string) {
    // In a real app, this would integrate with an external SMS/Email provider
    // For MVP, we'll just update the status to 'Sent' and record sentAt
    const message = await this.updateMessageStatus(tenantId, id, 'Sent', branchId);
    // Simulate sending time
    return this.prisma.message.update({
      where: { id: message.id },
      data: { sentAt: new Date() },
    });
  }
}
