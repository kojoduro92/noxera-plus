import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
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

  async createAttendanceRecord(
    tenantId: string,
    data: {
      serviceId: string;
      memberId?: string;
      visitorId?: string;
      method?: string;
      branchId?: string;
    },
    allowedBranchIds?: string[],
  ) {
    this.assertAllowedBranchAccess(allowedBranchIds, data.branchId);
    await this.assertBranchInTenant(tenantId, data.branchId);

    // Ensure service exists within the tenant (and optionally branch)
    const serviceWhere: any = { id: data.serviceId, tenantId };
    if (data.branchId) {
      serviceWhere.branchId = data.branchId;
    }
    const service = await this.prisma.service.findFirst({ where: serviceWhere });
    if (!service) throw new NotFoundException('Service not found for this tenant/branch');

    if (data.memberId) {
      const member = await this.prisma.member.findFirst({
        where: { id: data.memberId, tenantId },
        select: { id: true },
      });
      if (!member) throw new NotFoundException('Member not found for this tenant');
    }

    return this.prisma.attendance.create({
      data: {
        tenantId,
        branchId: data.branchId,
        serviceId: data.serviceId,
        memberId: data.memberId,
        visitorId: data.visitorId,
        method: data.method || 'manual',
      },
    });
  }

  async getAttendanceRecords(tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.prisma.attendance.findMany({
      where,
      include: { service: true, member: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAttendanceRecordById(id: string, tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const record = await this.prisma.attendance.findFirst({
      where,
      include: { service: true, member: true },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  async getAttendanceByService(serviceId: string, tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { serviceId, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.prisma.attendance.findMany({
      where,
      include: { member: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
