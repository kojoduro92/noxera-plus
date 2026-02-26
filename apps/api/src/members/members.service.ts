import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MemberWritePayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  occupation?: string;
  avatarUrl?: string;
  preferredContactMethod?: string;
  membershipDate?: string;
  baptismDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  status?: string;
  tags?: string[];
  branchId?: string;
};

type MemberUpdatePayload = Partial<MemberWritePayload>;

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  private async assertBranchInTenant(tenantId: string, branchId?: string) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found for this tenant');
    }
  }

  private assertAllowedBranchAccess(allowedBranchIds: string[] | undefined, branchId?: string) {
    if (!allowedBranchIds || !branchId) return;
    if (!allowedBranchIds.includes(branchId)) {
      throw new NotFoundException('Branch not found for this account scope');
    }
  }

  private normalizeString(value?: string) {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  private parseDate(value?: string) {
    const trimmed = this.normalizeString(value);
    if (!trimmed) return undefined;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
  }

  private compact<T extends Record<string, unknown>>(input: T) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
      [K in keyof T]?: Exclude<T[K], undefined>;
    };
  }

  private buildMemberData(data: MemberWritePayload | MemberUpdatePayload) {
    return {
      firstName: this.normalizeString(data.firstName),
      middleName: this.normalizeString(data.middleName),
      lastName: this.normalizeString(data.lastName),
      email: this.normalizeString(data.email),
      phone: this.normalizeString(data.phone),
      gender: this.normalizeString(data.gender),
      dateOfBirth: this.parseDate(data.dateOfBirth),
      maritalStatus: this.normalizeString(data.maritalStatus),
      occupation: this.normalizeString(data.occupation),
      avatarUrl: this.normalizeString(data.avatarUrl),
      preferredContactMethod: this.normalizeString(data.preferredContactMethod),
      membershipDate: this.parseDate(data.membershipDate),
      baptismDate: this.parseDate(data.baptismDate),
      addressLine1: this.normalizeString(data.addressLine1),
      addressLine2: this.normalizeString(data.addressLine2),
      city: this.normalizeString(data.city),
      state: this.normalizeString(data.state),
      postalCode: this.normalizeString(data.postalCode),
      country: this.normalizeString(data.country),
      emergencyContactName: this.normalizeString(data.emergencyContactName),
      emergencyContactPhone: this.normalizeString(data.emergencyContactPhone),
      notes: this.normalizeString(data.notes),
      customFields: data.customFields ?? undefined,
      status: this.normalizeString(data.status),
      tags: data.tags ?? undefined,
      branchId: this.normalizeString(data.branchId),
    };
  }

  async createMember(
    tenantId: string,
    data: MemberWritePayload,
  ) {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const payload = this.buildMemberData(data);

    if (!payload.firstName || !payload.lastName) {
      throw new BadRequestException('firstName and lastName are required.');
    }

    await this.assertBranchInTenant(tenantId, payload.branchId);

    const createData = this.compact({
      tenantId,
      ...payload,
      status: payload.status || 'Active',
      tags: payload.tags ?? [],
    }) as any;

    const member = await this.prisma.member.create({
      data: createData,
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'MEMBER_CREATE',
        resource: 'Member',
        details: {
          memberId: member.id,
          email: member.email,
          status: member.status,
          fullName: [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' '),
        },
      },
    });

    return member;
  }

  async getMembers(
    tenantId: string,
    options: {
      branchId?: string;
      status?: string;
      search?: string;
      allowedBranchIds?: string[];
    } = {},
  ) {
    this.assertAllowedBranchAccess(options.allowedBranchIds, options.branchId);
    await this.assertBranchInTenant(tenantId, options.branchId);
    const where: any = { tenantId };
    if (options.branchId) {
      where.branchId = options.branchId;
    } else if (options.allowedBranchIds && options.allowedBranchIds.length > 0) {
      where.branchId = { in: options.allowedBranchIds };
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.search) {
      where.OR = [
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { middleName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search, mode: 'insensitive' } },
        { emergencyContactName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.member.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getMemberById(id: string, tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const member = await this.prisma.member.findFirst({
      where,
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async updateMember(
    id: string,
    tenantId: string,
    data: MemberUpdatePayload,
    allowedBranchIds?: string[],
  ) {
    this.assertAllowedBranchAccess(allowedBranchIds, data.branchId);
    const existing = await this.prisma.member.findFirst({
      where: {
        id,
        tenantId,
        ...(allowedBranchIds && allowedBranchIds.length > 0 ? { branchId: { in: allowedBranchIds } } : {}),
      },
    });
    if (!existing) {
      throw new NotFoundException('Member not found');
    }

    await this.assertBranchInTenant(tenantId, data.branchId);

    const payload = this.compact(this.buildMemberData(data));
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No fields provided to update.');
    }

    const member = await this.prisma.member.update({
      where: { id },
      data: payload as any,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'MEMBER_UPDATE',
        resource: 'Member',
        details: {
          memberId: member.id,
          changedFields: Object.keys(payload).filter((key) => payload[key as keyof typeof payload] !== undefined),
        },
      },
    });

    return member;
  }

  async deleteMember(id: string, tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    // Ensure it exists and belongs to tenant (and optionally branch)
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const existing = await this.prisma.member.findFirst({ where });
    if (!existing) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.member.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'MEMBER_DELETE',
        resource: 'Member',
        details: {
          memberId: existing.id,
          email: existing.email,
        },
      },
    });

    return { success: true };
  }
}
