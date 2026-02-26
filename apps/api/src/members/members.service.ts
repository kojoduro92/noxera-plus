import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async createMember(tenantId: string, data: { firstName: string; lastName: string; email?: string; phone?: string; status?: string; branchId?: string }) {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.member.create({
      data: {
        tenantId,
        branchId: data.branchId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        status: data.status || 'Active',
      },
    });
  }

  async getMembers(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.member.findMany({
      where,
      orderBy: { lastName: 'asc' },
    });
  }

  async getMemberById(id: string, tenantId: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    const member = await this.prisma.member.findFirst({
      where,
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async updateMember(id: string, tenantId: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string; status?: string; branchId?: string }) {
    // Ensure it exists and belongs to tenant (and optionally branch)
    const where: any = { id, tenantId };
    if (data.branchId) {
      where.branchId = data.branchId;
    }
    await this.prisma.member.findFirst({ where }); 

    return this.prisma.member.update({
      where: { id },
      data,
    });
  }

  async deleteMember(id: string, tenantId: string, branchId?: string) {
    // Ensure it exists and belongs to tenant (and optionally branch)
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    await this.prisma.member.findFirst({ where });
    
    return this.prisma.member.delete({
      where: { id },
    });
  }
}
