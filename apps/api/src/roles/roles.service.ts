import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG, SYSTEM_ROLE_TEMPLATES } from './permission-catalog';
import { getPagination } from '../admin/admin.types';

type RoleFilters = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
};

type RoleWriteInput = {
  name: string;
  permissions: string[];
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  getPermissionCatalog() {
    return [...PERMISSION_CATALOG];
  }

  async ensureSystemRoles(tenantId: string) {
    await this.prisma.role.createMany({
      data: SYSTEM_ROLE_TEMPLATES.map((role) => ({
        tenantId,
        name: role.name,
        permissions: role.permissions,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
  }

  async listTenantRoles(tenantId: string, filters: RoleFilters = {}) {
    await this.ensureSystemRoles(tenantId);
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    const where = {
      tenantId,
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  async createRole(tenantId: string, input: RoleWriteInput) {
    const normalizedName = input.name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Role name is required.');
    }

    const permissions = this.normalizePermissions(input.permissions);
    const existing = await this.prisma.role.findFirst({
      where: {
        tenantId,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Role name already exists in this tenant.');
    }

    return this.prisma.role.create({
      data: {
        tenantId,
        name: normalizedName,
        permissions,
        isSystem: false,
      },
    });
  }

  async updateRole(tenantId: string, roleId: string, input: Partial<RoleWriteInput>) {
    const existing = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Role not found.');
    }

    const updates: { name?: string; permissions?: string[] } = {};
    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Role name cannot be empty.');
      }
      if (normalizedName.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await this.prisma.role.findFirst({
          where: {
            tenantId,
            id: { not: roleId },
            name: { equals: normalizedName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new BadRequestException('Another role already uses this name.');
        }
      }
      updates.name = normalizedName;
    }

    if (input.permissions !== undefined) {
      updates.permissions = this.normalizePermissions(input.permissions);
    }

    return this.prisma.role.update({
      where: { id: roleId },
      data: updates,
    });
  }

  async deleteRole(tenantId: string, roleId: string, reassignRoleId?: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted.');
    }

    if (role._count.users > 0) {
      if (!reassignRoleId) {
        throw new BadRequestException('Role is assigned to users. Provide reassignRoleId.');
      }
      const replacement = await this.prisma.role.findFirst({
        where: { id: reassignRoleId, tenantId },
        select: { id: true },
      });
      if (!replacement) {
        throw new BadRequestException('Reassignment role not found in this tenant.');
      }
      await this.prisma.user.updateMany({
        where: { tenantId, roleId },
        data: { roleId: reassignRoleId },
      });
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true };
  }

  async listGlobalRoles(filters: RoleFilters = {}) {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { tenant: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
          ],
        }
      : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ tenantId: 'asc' }, { isSystem: 'desc' }, { name: 'asc' }],
        include: {
          tenant: { select: { id: true, name: true, domain: true } },
          _count: { select: { users: true } },
        },
      }),
    ]);

    return {
      items,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  private normalizePermissions(permissions: string[] = []) {
    const normalized = Array.from(
      new Set(
        permissions
          .map((permission) => permission.trim())
          .filter((permission) => permission.length > 0 && PERMISSION_CATALOG.includes(permission as (typeof PERMISSION_CATALOG)[number])),
      ),
    );
    if (normalized.length === 0) {
      throw new BadRequestException('At least one valid permission is required.');
    }
    return normalized;
  }
}
