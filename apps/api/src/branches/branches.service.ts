import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async createBranch(
    tenantId: string,
    data: { name: string; location?: string },
    actor?: { email?: string | null; userId?: string | null },
  ) {
    const normalizedName = data.name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Branch name is required.');
    }
    const existing = await this.prisma.branch.findFirst({
      where: {
        tenantId,
        isActive: true,
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('An active branch with this name already exists.');
    }

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        name: normalizedName,
        location: data.location?.trim() || null,
        isActive: true,
      },
    });

    await this.recordAudit(tenantId, 'BRANCH_CREATED', actor, {
      branchId: branch.id,
      name: branch.name,
      location: branch.location,
    });

    return branch;
  }

  async getBranches(tenantId: string, includeArchived = false) {
    return this.prisma.branch.findMany({
      where: {
        tenantId,
        ...(includeArchived ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getBranchById(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async updateBranch(
    tenantId: string,
    id: string,
    data: { name?: string; location?: string },
    actor?: { email?: string | null; userId?: string | null },
  ) {
    const branch = await this.getBranchById(tenantId, id);
    const nextName = data.name?.trim();
    if (nextName && nextName.toLowerCase() !== branch.name.toLowerCase()) {
      const duplicate = await this.prisma.branch.findFirst({
        where: {
          tenantId,
          id: { not: id },
          isActive: true,
          name: { equals: nextName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException('Another active branch already uses this name.');
      }
    }

    const updatedBranch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
      },
    });

    await this.recordAudit(tenantId, 'BRANCH_UPDATED', actor, {
      branchId: updatedBranch.id,
      before: {
        name: branch.name,
        location: branch.location,
      },
      after: {
        name: updatedBranch.name,
        location: updatedBranch.location,
      },
    });

    return updatedBranch;
  }

  async archiveBranch(
    tenantId: string,
    id: string,
    actor?: { email?: string | null; userId?: string | null },
  ) {
    const branch = await this.getBranchById(tenantId, id);
    if (!branch.isActive) return branch;

    const activeBranchCount = await this.prisma.branch.count({
      where: { tenantId, isActive: true },
    });
    if (activeBranchCount <= 1) {
      throw new BadRequestException('Cannot archive the last active branch.');
    }

    const restrictedUsersOnlyOnThisBranch = await this.prisma.user.count({
      where: {
        tenantId,
        branchScopeMode: 'RESTRICTED',
        branchAccess: {
          some: { branchId: id },
        },
        NOT: {
          branchAccess: {
            some: { branchId: { not: id } },
          },
        },
      },
    });
    if (restrictedUsersOnlyOnThisBranch > 0) {
      throw new BadRequestException('Cannot archive branch while restricted users depend on it as their only access.');
    }

    await this.prisma.userBranchAccess.deleteMany({
      where: { branchId: id },
    });

    const updatedBranch = await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    await this.recordAudit(tenantId, 'BRANCH_ARCHIVED', actor, {
      branchId: updatedBranch.id,
      name: updatedBranch.name,
    });

    return updatedBranch;
  }

  async unarchiveBranch(
    tenantId: string,
    id: string,
    actor?: { email?: string | null; userId?: string | null },
  ) {
    await this.getBranchById(tenantId, id);
    const updatedBranch = await this.prisma.branch.update({
      where: { id },
      data: { isActive: true },
    });

    await this.recordAudit(tenantId, 'BRANCH_UNARCHIVED', actor, {
      branchId: updatedBranch.id,
      name: updatedBranch.name,
    });

    return updatedBranch;
  }

  async getBranchStats(tenantId: string, id: string) {
    await this.getBranchById(tenantId, id);
    const [members, services, attendances, users] = await Promise.all([
      this.prisma.member.count({ where: { tenantId, branchId: id } }),
      this.prisma.service.count({ where: { tenantId, branchId: id } }),
      this.prisma.attendance.count({ where: { tenantId, branchId: id } }),
      this.prisma.user.count({
        where: {
          tenantId,
          OR: [{ branchId: id }, { branchAccess: { some: { branchId: id } } }],
        },
      }),
    ]);

    return {
      branchId: id,
      members,
      services,
      attendances,
      users,
    };
  }

  private async recordAudit(
    tenantId: string,
    action: string,
    actor: { email?: string | null; userId?: string | null } | undefined,
    details: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actor?.userId ?? null,
        action,
        resource: 'Branch',
        details: {
          actorEmail: actor?.email ?? 'unknown',
          ...details,
        },
      },
    });
  }
}
