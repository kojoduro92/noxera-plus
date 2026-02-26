import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async createGroup(tenantId: string, data: { name: string; type: string; description?: string; branchId?: string }) {
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

  async getGroups(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
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

  async getGroupById(tenantId: string, id: string, branchId?: string) {
    const where: any = { id, tenantId };
    if (branchId) {
      where.branchId = branchId;
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

  async addMemberToGroup(tenantId: string, groupId: string, memberId: string, role: string = 'Member', branchId?: string) {
    // Ensure group exists
    const groupWhere: any = { id: groupId, tenantId };
    if (branchId) {
      groupWhere.branchId = branchId;
    }
    await this.prisma.group.findFirst({ where: groupWhere });

    return this.prisma.groupMember.create({
      data: {
        groupId,
        memberId,
        role,
      }
    });
  }
}
