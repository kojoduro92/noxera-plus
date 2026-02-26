import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
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

  async createService(tenantId: string, data: { name: string; date: string; branchId?: string }, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, data.branchId);
    await this.assertBranchInTenant(tenantId, data.branchId);
    return this.prisma.service.create({
      data: {
        tenantId,
        branchId: data.branchId,
        name: data.name,
        date: new Date(data.date),
      },
    });
  }

  async getServices(tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.prisma.service.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getServiceById(id: string, tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const service = await this.prisma.service.findFirst({
      where,
      include: { attendances: true }
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
