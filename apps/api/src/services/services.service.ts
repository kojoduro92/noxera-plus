import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async createService(tenantId: string, data: { name: string; date: string; branchId?: string }) {
    return this.prisma.service.create({
      data: {
        tenantId,
        branchId: data.branchId,
        name: data.name,
        date: new Date(data.date),
      },
    });
  }

  async getServices(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.service.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getServiceById(id: string, tenantId: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const service = await this.prisma.service.findFirst({
      where,
      include: { attendances: true }
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
