import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async createAttendanceRecord(
    tenantId: string,
    data: {
      serviceId: string;
      memberId?: string;
      visitorId?: string;
      method?: string;
      branchId?: string;
    },
  ) {
    // Ensure service exists within the tenant (and optionally branch)
    const serviceWhere: any = { id: data.serviceId, tenantId };
    if (data.branchId) {
      serviceWhere.branchId = data.branchId;
    }
    const service = await this.prisma.service.findFirst({ where: serviceWhere });
    if (!service) throw new NotFoundException('Service not found for this tenant/branch');

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

  async getAttendanceRecords(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.attendance.findMany({
      where,
      include: { service: true, member: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAttendanceRecordById(id: string, tenantId: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const record = await this.prisma.attendance.findFirst({
      where,
      include: { service: true, member: true },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  async getAttendanceByService(serviceId: string, tenantId: string, branchId?: string) {
    const where: any = { serviceId, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.attendance.findMany({
      where,
      include: { member: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
