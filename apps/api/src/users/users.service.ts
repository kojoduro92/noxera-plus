import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination } from '../admin/admin.types';

type TenantUserFilters = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  status?: unknown;
  roleId?: unknown;
};

type PlatformUserFilters = TenantUserFilters & {
  tenantId?: unknown;
  provider?: unknown;
};

type InviteUserInput = {
  email: string;
  name: string;
  roleId: string;
  branchScopeMode?: 'ALL' | 'RESTRICTED';
  branchIds?: string[];
  defaultBranchId?: string;
};

type UpdateUserInput = {
  name?: string;
  status?: 'Invited' | 'Active' | 'Suspended';
  roleId?: string;
  branchScopeMode?: 'ALL' | 'RESTRICTED';
  branchIds?: string[];
  defaultBranchId?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenantUsers(tenantId: string, filters: TenantUserFilters = {}) {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    const status = typeof filters.status === 'string' ? filters.status.trim() : '';
    const roleId = typeof filters.roleId === 'string' ? filters.roleId.trim() : '';
    const where: any = {
      tenantId,
      isSuperAdmin: false,
      ...(status ? { status } : {}),
      ...(roleId ? { roleId } : {}),
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          role: { select: { id: true, name: true, isSystem: true, permissions: true } },
          branch: { select: { id: true, name: true } },
          branchAccess: {
            include: {
              branch: { select: { id: true, name: true, isActive: true } },
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

  async inviteUser(tenantId: string, data: InviteUserInput, actorEmail: string, actorUserId?: string) {
    const email = this.normalizeEmail(data.email);
    const name = data.name?.trim();
    if (!email || !name) {
      throw new BadRequestException('name and email are required.');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: data.roleId, tenantId },
      select: { id: true, name: true },
    });
    if (!role) {
      throw new BadRequestException('roleId is invalid for this tenant.');
    }

    const scope = data.branchScopeMode === 'RESTRICTED' ? 'RESTRICTED' : 'ALL';
    const branchIds = await this.validateBranchIds(tenantId, data.branchIds ?? []);
    const defaultBranchId = await this.validateDefaultBranch(tenantId, data.defaultBranchId, branchIds, scope);

    if (scope === 'RESTRICTED' && branchIds.length === 0) {
      throw new BadRequestException('Restricted users must have at least one branch access assignment.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, isSuperAdmin: true },
    });

    let userId: string;
    if (existing) {
      if (existing.isSuperAdmin) {
        throw new BadRequestException('Cannot convert super-admin account to tenant user via invite flow.');
      }
      if (existing.tenantId && existing.tenantId !== tenantId) {
        throw new BadRequestException('This email already belongs to a different tenant.');
      }

      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          tenantId,
          name,
          roleId: role.id,
          status: 'Invited',
          invitedAt: new Date(),
          invitedByUserId: actorUserId ?? null,
          branchScopeMode: scope,
          branchId: defaultBranchId,
        },
        select: { id: true },
      });
      userId = updated.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          tenantId,
          name,
          email,
          roleId: role.id,
          status: 'Invited',
          branchScopeMode: scope,
          branchId: defaultBranchId,
          invitedByUserId: actorUserId ?? null,
        },
        select: { id: true },
      });
      userId = created.id;
    }

    await this.replaceBranchAccess(userId, scope, branchIds);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorUserId ?? null,
        action: 'USER_INVITE_CREATED',
        resource: 'User',
        details: {
          actorEmail,
          targetUserId: userId,
          email,
          roleId: role.id,
          branchScopeMode: scope,
          branchIds,
        },
      },
    });

    await this.createTenantNotificationAndOutbox(tenantId, {
      type: 'user.invited',
      title: 'You were invited to a church workspace',
      body: `Use ${email} to sign in and claim your ${role.name} access.`,
      severity: 'info',
      targetUserId: userId,
      targetEmail: email,
      outboxTemplate: 'user.invite.link',
      outboxPayload: {
        tenantId,
        role: role.name,
        invitedBy: actorEmail,
      },
    });

    return this.getTenantUserById(tenantId, userId);
  }

  async updateUser(tenantId: string, userId: string, data: UpdateUserInput, actorEmail: string, actorUserId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isSuperAdmin: false },
      include: {
        role: { select: { id: true, name: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found for this tenant.');
    }

    const nextRoleId = data.roleId ?? user.roleId ?? undefined;
    if (!nextRoleId) {
      throw new BadRequestException('User must have a role assignment.');
    }
    const nextRole = await this.prisma.role.findFirst({
      where: { id: nextRoleId, tenantId },
      select: { id: true, name: true },
    });
    if (!nextRole) {
      throw new BadRequestException('Selected role does not exist in this tenant.');
    }

    const nextStatus = data.status ?? (user.status as 'Invited' | 'Active' | 'Suspended');
    await this.assertOwnerRetention(tenantId, user.id, user.role?.name ?? null, nextRole.name, nextStatus);

    const scope = data.branchScopeMode ?? (user.branchScopeMode === 'RESTRICTED' ? 'RESTRICTED' : 'ALL');
    const existingBranchIds = await this.getCurrentBranchAccessIds(user.id);
    const requestedBranchIds = data.branchIds ? await this.validateBranchIds(tenantId, data.branchIds) : existingBranchIds;
    if (scope === 'RESTRICTED' && requestedBranchIds.length === 0) {
      throw new BadRequestException('Restricted users must have at least one branch access assignment.');
    }

    const defaultBranchId = await this.validateDefaultBranch(
      tenantId,
      data.defaultBranchId === undefined ? user.branchId ?? undefined : data.defaultBranchId ?? undefined,
      requestedBranchIds,
      scope,
    );

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.roleId !== undefined ? { roleId: nextRole.id } : {}),
        ...(data.branchScopeMode !== undefined ? { branchScopeMode: scope } : {}),
        branchId: defaultBranchId,
      },
    });

    if (data.branchIds !== undefined || data.branchScopeMode !== undefined) {
      await this.replaceBranchAccess(user.id, scope, requestedBranchIds);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorUserId ?? null,
        action: 'USER_UPDATED',
        resource: 'User',
        details: {
          actorEmail,
          targetUserId: user.id,
          changes: {
            name: data.name ?? null,
            status: data.status ?? null,
            roleId: data.roleId ?? null,
            branchScopeMode: data.branchScopeMode ?? null,
            defaultBranchId: data.defaultBranchId ?? null,
            branchIds: data.branchIds ?? null,
          },
        },
      },
    });

    if (data.status && data.status !== user.status) {
      const statusLabel = data.status === 'Suspended' ? 'suspended' : data.status === 'Active' ? 'active' : 'invited';
      await this.createTenantNotificationAndOutbox(tenantId, {
        type: `user.status.${statusLabel}`,
        title: `Your account is now ${statusLabel}`,
        body:
          data.status === 'Suspended'
            ? 'Your account was suspended. Contact your tenant owner for restoration.'
            : 'Your account status was updated and access is available.',
        severity: data.status === 'Suspended' ? 'warning' : 'info',
        targetUserId: user.id,
        targetEmail: user.email,
        outboxTemplate: 'user.status.changed',
        outboxPayload: {
          tenantId,
          status: data.status,
          actorEmail,
        },
      });
    }

    if (data.roleId && data.roleId !== user.roleId) {
      await this.createTenantNotificationAndOutbox(tenantId, {
        type: 'user.role.updated',
        title: 'Your role was updated',
        body: `Your workspace role is now ${nextRole.name}.`,
        severity: 'info',
        targetUserId: user.id,
        targetEmail: user.email,
        outboxTemplate: 'user.role.changed',
        outboxPayload: {
          tenantId,
          roleName: nextRole.name,
          actorEmail,
        },
      });
    }

    return this.getTenantUserById(tenantId, updated.id);
  }

  async updateUserRole(tenantId: string, userId: string, roleId: string, actorEmail: string, actorUserId?: string) {
    return this.updateUser(tenantId, userId, { roleId }, actorEmail, actorUserId);
  }

  async updateUserBranches(tenantId: string, userId: string, branchScopeMode: 'ALL' | 'RESTRICTED', branchIds: string[], actorEmail: string, actorUserId?: string) {
    return this.updateUser(tenantId, userId, { branchScopeMode, branchIds }, actorEmail, actorUserId);
  }

  async resendInvite(tenantId: string, userId: string, actorEmail: string, actorUserId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isSuperAdmin: false },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found for this tenant.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'Invited',
        invitedAt: new Date(),
        invitedByUserId: actorUserId ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorUserId ?? null,
        action: 'USER_INVITE_RESENT',
        resource: 'User',
        details: { actorEmail, targetUserId: user.id, email: user.email },
      },
    });

    await this.createTenantNotificationAndOutbox(tenantId, {
      type: 'user.invite.resent',
      title: 'Workspace invitation resent',
      body: 'A fresh sign-in invitation was sent to your email.',
      severity: 'info',
      targetUserId: user.id,
      targetEmail: user.email,
      outboxTemplate: 'user.invite.resend',
      outboxPayload: {
        tenantId,
        actorEmail,
      },
    });

    return this.getTenantUserById(tenantId, user.id);
  }

  async suspendUser(tenantId: string, userId: string, actorEmail: string, actorUserId?: string) {
    return this.updateUser(tenantId, userId, { status: 'Suspended' }, actorEmail, actorUserId);
  }

  async reactivateUser(tenantId: string, userId: string, actorEmail: string, actorUserId?: string) {
    return this.updateUser(tenantId, userId, { status: 'Active' }, actorEmail, actorUserId);
  }

  async listPlatformUsers(filters: PlatformUserFilters = {}) {
    const pagination = getPagination(filters);
    const tenantId = typeof filters.tenantId === 'string' ? filters.tenantId.trim() : '';
    const status = typeof filters.status === 'string' ? filters.status.trim() : '';
    const roleId = typeof filters.roleId === 'string' ? filters.roleId.trim() : '';
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    const provider = typeof filters.provider === 'string' ? filters.provider.trim() : '';

    const where: any = {
      isSuperAdmin: false,
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
      ...(roleId ? { roleId } : {}),
      ...(provider ? { lastSignInProvider: provider } : {}),
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { tenant: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          tenant: { select: { id: true, name: true, domain: true } },
          role: { select: { id: true, name: true, isSystem: true } },
          branch: { select: { id: true, name: true } },
          branchAccess: { include: { branch: { select: { id: true, name: true } } } },
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

  async getPlatformUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: { select: { id: true, name: true, domain: true } },
        role: { select: { id: true, name: true, permissions: true, isSystem: true } },
        branch: { select: { id: true, name: true } },
        branchAccess: { include: { branch: { select: { id: true, name: true } } } },
      },
    });
    if (!user || user.isSuperAdmin) {
      throw new NotFoundException('Platform user not found.');
    }
    return user;
  }

  async platformUpdateStatus(userId: string, status: 'Invited' | 'Active' | 'Suspended', actorEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.tenantId || user.isSuperAdmin) {
      throw new NotFoundException('Platform user not found.');
    }
    await this.assertOwnerRetention(user.tenantId, user.id, null, null, status);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        action: 'SUPER_ADMIN_USER_STATUS_UPDATED',
        resource: 'User',
        details: { actorEmail, targetUserId: userId, previousStatus: user.status, status },
      },
    });
    return updated;
  }

  async platformUpdateRole(userId: string, roleId: string, actorEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { name: true } } },
    });
    if (!user || !user.tenantId || user.isSuperAdmin) {
      throw new NotFoundException('Platform user not found.');
    }
    const nextRole = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });
    if (!nextRole) {
      throw new BadRequestException('Role does not belong to user tenant.');
    }
    await this.assertOwnerRetention(user.tenantId, user.id, user.role?.name ?? null, nextRole.name, user.status as any);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: nextRole.id },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        action: 'SUPER_ADMIN_USER_ROLE_UPDATED',
        resource: 'User',
        details: { actorEmail, targetUserId: userId, roleId: nextRole.id, roleName: nextRole.name },
      },
    });
    return updated;
  }

  async platformTransferTenant(userId: string, tenantId: string, actorEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { name: true } } },
    });
    if (!user || user.isSuperAdmin || !user.tenantId) {
      throw new NotFoundException('Platform user not found.');
    }
    const targetTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!targetTenant) {
      throw new BadRequestException('Target tenant not found.');
    }
    if (targetTenant.id === user.tenantId) {
      throw new BadRequestException('User is already in that tenant.');
    }

    await this.assertOwnerRetention(user.tenantId, user.id, user.role?.name ?? null, null, user.status as any);

    const fallbackRole = await this.prisma.role.findFirst({
      where: { tenantId: targetTenant.id, name: 'Staff' },
      select: { id: true },
    });
    if (!fallbackRole) {
      throw new BadRequestException('Target tenant is missing system roles.');
    }

    await this.prisma.$transaction([
      this.prisma.userBranchAccess.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          tenantId: targetTenant.id,
          roleId: fallbackRole.id,
          branchScopeMode: 'ALL',
          branchId: null,
          status: 'Invited',
          invitedAt: new Date(),
        },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        tenantId: targetTenant.id,
        action: 'SUPER_ADMIN_USER_TENANT_TRANSFERRED',
        resource: 'User',
        details: { actorEmail, targetUserId: userId, previousTenantId: user.tenantId, tenantId: targetTenant.id },
      },
    });

    return this.getPlatformUserById(userId);
  }

  async platformResetAccess(userId: string, actorEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, isSuperAdmin: true },
    });
    if (!user || !user.tenantId || user.isSuperAdmin) {
      throw new NotFoundException('Platform user not found.');
    }

    await this.prisma.$transaction([
      this.prisma.userBranchAccess.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          branchScopeMode: 'ALL',
          branchId: null,
          status: 'Active',
        },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        action: 'SUPER_ADMIN_USER_ACCESS_RESET',
        resource: 'User',
        details: { actorEmail, targetUserId: userId },
      },
    });

    return this.getPlatformUserById(userId);
  }

  async getPlatformOverview() {
    const [churches, branches, users, invitedUsers, suspendedUsers, activeUsers, roles, customRoles] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.branch.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isSuperAdmin: false } }),
      this.prisma.user.count({ where: { isSuperAdmin: false, status: 'Invited' } }),
      this.prisma.user.count({ where: { isSuperAdmin: false, status: 'Suspended' } }),
      this.prisma.user.count({ where: { isSuperAdmin: false, status: 'Active' } }),
      this.prisma.role.count(),
      this.prisma.role.count({ where: { isSystem: false } }),
    ]);

    return {
      churches,
      branches,
      users,
      activeUsers,
      invitedUsers,
      suspendedUsers,
      roles,
      customRoles,
    };
  }

  private async getTenantUserById(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isSuperAdmin: false },
      include: {
        role: { select: { id: true, name: true, permissions: true, isSystem: true } },
        branch: { select: { id: true, name: true } },
        branchAccess: { include: { branch: { select: { id: true, name: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found for this tenant.');
    }
    return user;
  }

  private normalizeEmail(value?: string) {
    return value?.trim().toLowerCase() ?? '';
  }

  private async validateBranchIds(tenantId: string, branchIds: string[]) {
    const normalized = Array.from(new Set(branchIds.map((branchId) => branchId.trim()).filter(Boolean)));
    if (normalized.length === 0) {
      return [];
    }
    const branches = await this.prisma.branch.findMany({
      where: {
        tenantId,
        id: { in: normalized },
        isActive: true,
      },
      select: { id: true },
    });
    if (branches.length !== normalized.length) {
      throw new BadRequestException('One or more branch IDs are invalid for this tenant.');
    }
    return normalized;
  }

  private async validateDefaultBranch(tenantId: string, defaultBranchId: string | undefined, branchIds: string[], scope: 'ALL' | 'RESTRICTED') {
    if (!defaultBranchId) return null;
    const normalized = defaultBranchId.trim();
    if (!normalized) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { id: normalized, tenantId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('defaultBranchId is invalid for this tenant.');
    }
    if (scope === 'RESTRICTED' && branchIds.length > 0 && !branchIds.includes(normalized)) {
      throw new BadRequestException('defaultBranchId must be included in restricted branch access list.');
    }
    return normalized;
  }

  private async replaceBranchAccess(userId: string, scope: 'ALL' | 'RESTRICTED', branchIds: string[]) {
    await this.prisma.userBranchAccess.deleteMany({ where: { userId } });
    if (scope === 'RESTRICTED' && branchIds.length > 0) {
      await this.prisma.userBranchAccess.createMany({
        data: branchIds.map((branchId) => ({ userId, branchId })),
        skipDuplicates: true,
      });
    }
  }

  private async getCurrentBranchAccessIds(userId: string) {
    const rows = await this.prisma.userBranchAccess.findMany({
      where: { userId },
      select: { branchId: true },
    });
    return rows.map((row) => row.branchId);
  }

  private async assertOwnerRetention(
    tenantId: string,
    targetUserId: string,
    currentRoleName: string | null,
    nextRoleName: string | null,
    nextStatus: 'Invited' | 'Active' | 'Suspended' | null,
  ) {
    const currentlyOwner =
      currentRoleName === 'Owner' ||
      (await this.prisma.user.count({
        where: {
          id: targetUserId,
          tenantId,
          role: { is: { name: 'Owner' } },
        },
      })) > 0;

    if (!currentlyOwner) {
      return;
    }

    const willStillBeOwner = nextRoleName ? nextRoleName === 'Owner' : true;
    const willBeSuspended = nextStatus === 'Suspended';
    if (willStillBeOwner && !willBeSuspended) {
      return;
    }

    const activeOwnerCount = await this.prisma.user.count({
      where: {
        tenantId,
        status: { not: 'Suspended' },
        role: { is: { name: 'Owner' } },
      },
    });
    if (activeOwnerCount <= 1) {
      throw new BadRequestException('Cannot remove or suspend the last active Owner in this tenant.');
    }
  }

  private async createTenantNotificationAndOutbox(
    tenantId: string,
    input: {
      type: string;
      title: string;
      body: string;
      severity: 'info' | 'warning' | 'critical' | 'success';
      targetUserId?: string | null;
      targetEmail?: string | null;
      outboxTemplate?: string;
      outboxPayload?: Record<string, unknown>;
    },
  ) {
    await this.prisma.notification.create({
      data: {
        tenantId,
        scope: 'tenant',
        type: input.type,
        title: input.title,
        body: input.body,
        severity: input.severity,
        targetUserId: input.targetUserId ?? null,
        targetEmail: input.targetEmail?.trim().toLowerCase() ?? null,
        meta: (input.outboxPayload ?? null) as any,
      },
    });

    if (input.outboxTemplate && input.targetEmail) {
      await this.prisma.outboxMessage.create({
        data: {
          tenantId,
          templateId: input.outboxTemplate,
          recipient: input.targetEmail.trim().toLowerCase(),
          payload: (input.outboxPayload ?? null) as any,
          status: 'Pending',
        },
      });
    }
  }
}
