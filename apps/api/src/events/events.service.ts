import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async createEvent(tenantId: string, data: { title: string; description?: string; startDate: string; endDate: string; location?: string; branchId?: string }) {
    return this.prisma.event.create({
      data: {
        tenantId,
        branchId: data.branchId,
        title: data.title,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        location: data.location,
      },
    });
  }

  async getEvents(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.event.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async getEventById(tenantId: string, id: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const event = await this.prisma.event.findFirst({
      where,
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
