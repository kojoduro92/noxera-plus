import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
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

  async createGroup(tenantId: string, data: { name: string; type: string; description?: string; branchId?: string }, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, data.branchId);
    await this.assertBranchInTenant(tenantId, data.branchId);
    return this.prisma.group.create({
      data: {
        tenantId,
        branchId: data.branchId,
        name: data.name,
        type: data.type,
        description: data.description,
      },
    });
  }

  async getGroups(tenantId: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.prisma.group.findMany({
      where,
      include: {
        _count: {
          select: { members: true }
        }
      }
    });
  }

  async getGroupById(tenantId: string, id: string, branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    const group = await this.prisma.group.findFirst({
      where,
      include: {
        members: {
          include: {
            member: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async addMemberToGroup(tenantId: string, groupId: string, memberId: string, role: string = 'Member', branchId?: string, allowedBranchIds?: string[]) {
    this.assertAllowedBranchAccess(allowedBranchIds, branchId);
    await this.assertBranchInTenant(tenantId, branchId);
    // Ensure group exists
    const groupWhere: any = { id: groupId, tenantId };
    if (branchId) {
      groupWhere.branchId = branchId;
    }
    const group = await this.prisma.group.findFirst({ where: groupWhere, select: { id: true } });
    if (!group) throw new NotFoundException('Group not found');

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found for this tenant');

    return this.prisma.groupMember.create({
      data: {
        groupId,
        memberId,
        role,
      }
    });
  }
}
