import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ROLE_TEMPLATES } from '../roles/permission-catalog';
import type { CreateTenantPayload, TenantSizeRange } from './tenants.types';

type TenantProfileMetadata = {
  ownerName: string;
  ownerPhone: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  denomination: string | null;
  sizeRange: TenantSizeRange | null;
};

const COUNTRY_DEFAULTS: Record<string, { timezone: string; currency: string }> = {
  GH: { timezone: 'Africa/Accra', currency: 'GHS' },
  NG: { timezone: 'Africa/Lagos', currency: 'NGN' },
  ZA: { timezone: 'Africa/Johannesburg', currency: 'ZAR' },
  KE: { timezone: 'Africa/Nairobi', currency: 'KES' },
  US: { timezone: 'America/New_York', currency: 'USD' },
  CA: { timezone: 'America/Toronto', currency: 'CAD' },
  GB: { timezone: 'Europe/London', currency: 'GBP' },
};

const ALLOWED_SIZE_RANGES = new Set<TenantSizeRange>(['1-50', '51-150', '151-300', '301-700', '701-1500', '1500+']);

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  private canonicalPlanName(planName: string): string {
    const normalized = planName.trim().toLowerCase();
    if (normalized === 'basic') return 'Basic';
    if (normalized === 'enterprise') return 'Enterprise';
    return 'Pro';
  }

  private resolvePlanPrice(planName: string): number {
    const normalized = planName.trim().toLowerCase();
    if (normalized === 'basic') return 49;
    if (normalized === 'pro') return 99;
    if (normalized === 'enterprise') return 199;
    return 0;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeDomain(domain: string) {
    return domain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  private normalizeMetadataValue(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private resolveTenantMetadata(data: CreateTenantPayload): TenantProfileMetadata {
    const ownerName = data.ownerName?.trim();
    if (!ownerName) {
      throw new BadRequestException('Owner name is required');
    }

    const country = this.normalizeMetadataValue(data.country)?.toUpperCase() ?? null;
    const countryDefaults = country ? COUNTRY_DEFAULTS[country] : undefined;
    const timezone = this.normalizeMetadataValue(data.timezone) ?? countryDefaults?.timezone ?? 'UTC';
    const currency = this.normalizeMetadataValue(data.currency)?.toUpperCase() ?? countryDefaults?.currency ?? 'USD';
    const sizeRange = this.normalizeMetadataValue(data.sizeRange) as TenantSizeRange | null;
    if (sizeRange && !ALLOWED_SIZE_RANGES.has(sizeRange)) {
      throw new BadRequestException('Invalid sizeRange value');
    }

    return {
      ownerName,
      ownerPhone: this.normalizeMetadataValue(data.ownerPhone),
      country,
      timezone,
      currency,
      denomination: this.normalizeMetadataValue(data.denomination),
      sizeRange,
    };
  }

  private toMetadataFeatures(metadata: TenantProfileMetadata) {
    const entries: string[] = [];
    const metadataMap: Record<string, string | null> = {
      owner_name: metadata.ownerName,
      owner_phone: metadata.ownerPhone,
      country: metadata.country,
      timezone: metadata.timezone,
      currency: metadata.currency,
      denomination: metadata.denomination,
      size_range: metadata.sizeRange,
    };
    Object.entries(metadataMap).forEach(([key, value]) => {
      if (!value) return;
      entries.push(`meta.${key}:${encodeURIComponent(value)}`);
    });
    return entries;
  }

  private extractMetadata(features: string[]): TenantProfileMetadata {
    const extracted: Record<string, string> = {};
    for (const feature of features) {
      if (!feature.startsWith('meta.')) continue;
      const separator = feature.indexOf(':');
      if (separator === -1) continue;
      const key = feature.slice(5, separator);
      const value = feature.slice(separator + 1);
      extracted[key] = decodeURIComponent(value);
    }

    const normalizedSizeRange = extracted.size_range as TenantSizeRange | undefined;
    return {
      ownerName: extracted.owner_name ?? 'Church Owner',
      ownerPhone: extracted.owner_phone ?? null,
      country: extracted.country ?? null,
      timezone: extracted.timezone ?? 'UTC',
      currency: extracted.currency ?? 'USD',
      denomination: extracted.denomination ?? null,
      sizeRange: normalizedSizeRange && ALLOWED_SIZE_RANGES.has(normalizedSizeRange) ? normalizedSizeRange : null,
    };
  }

  async createTenant(data: CreateTenantPayload) {
    const normalizedDomain = this.normalizeDomain(data.domain);
    const normalizedEmail = this.normalizeEmail(data.adminEmail);
    const requestedPlanName = this.canonicalPlanName(data.plan?.trim() || 'Pro');
    const metadata = this.resolveTenantMetadata(data);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    if (!normalizedDomain) {
      throw new BadRequestException('Domain is required');
    }

    if (!normalizedEmail) {
      throw new BadRequestException('Admin email is required');
    }

    try {
      // 1. Validate if domain already exists
      const existing = await this.prisma.tenant.findUnique({
        where: { domain: normalizedDomain },
      });

      if (existing) {
        throw new BadRequestException('Domain is already taken');
      }

      // 2. Ensure selected paid plan + default trial plan exist
      const selectedPlan = await this.prisma.plan.upsert({
        where: { name: requestedPlanName },
        update: {},
        create: {
          name: requestedPlanName,
          price: this.resolvePlanPrice(requestedPlanName),
          modules: [],
          limits: {},
        },
      });

      const trialPlan = await this.prisma.plan.upsert({
        where: { name: 'Trial' },
        update: {
          price: 0,
        },
        create: {
          name: 'Trial',
          description: '14-day free trial',
          price: 0,
          modules: [],
          limits: {},
        },
      });

      const defaultBranchName = data.branchName?.trim() || 'Main Campus';
      const features = [
        'trial_active',
        `trial_ends_at:${trialEndsAt.toISOString()}`,
        `pending_plan:${selectedPlan.name}`,
        ...this.toMetadataFeatures(metadata),
      ];

      // 3. Create Tenant, default branch, system roles, and invited owner user.
      const tenant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.tenant.create({
          data: {
            name: data.churchName,
            domain: normalizedDomain,
            planId: trialPlan.id,
            features,
            users: {
              create: {
                email: normalizedEmail,
                name: metadata.ownerName,
                status: 'Invited',
                branchScopeMode: 'ALL',
              },
            },
            branches: {
              create: { name: defaultBranchName, location: 'Main Campus', isActive: true },
            },
          },
          include: {
            plan: true,
            users: {
              select: { id: true },
            },
            branches: {
              select: { id: true },
            },
          },
        });

        await tx.role.createMany({
          data: SYSTEM_ROLE_TEMPLATES.map((role) => ({
            tenantId: created.id,
            name: role.name,
            permissions: [...role.permissions],
            isSystem: true,
          })),
          skipDuplicates: true,
        });

        const ownerRole = await tx.role.findFirst({
          where: { tenantId: created.id, name: 'Owner' },
          select: { id: true },
        });

        const ownerUser = created.users[0];
        const mainBranch = created.branches[0];
        if (ownerRole && ownerUser) {
          await tx.user.update({
            where: { id: ownerUser.id },
            data: {
              roleId: ownerRole.id,
              branchId: mainBranch?.id,
            },
          });
        }

        return created;
      });

      const ownerUserId = tenant.users[0]?.id ?? null;
      await this.prisma.notification.createMany({
        data: [
          {
            tenantId: tenant.id,
            scope: 'tenant',
            type: 'owner.invited',
            title: 'Owner invitation ready',
            body: `Sign in with ${normalizedEmail} to claim owner access for ${data.churchName}.`,
            severity: 'info',
            targetUserId: ownerUserId,
            targetEmail: normalizedEmail,
            meta: {
              tenantId: tenant.id,
              tenantName: data.churchName,
              loginPath: '/login',
            } as Prisma.InputJsonValue,
          },
          {
            tenantId: null,
            scope: 'platform',
            type: 'tenant.created',
            title: 'New church workspace created',
            body: `${data.churchName} (${normalizedDomain}) was provisioned on trial.`,
            severity: 'success',
            targetEmail: null,
            meta: {
              tenantId: tenant.id,
              domain: normalizedDomain,
              selectedPlan: selectedPlan.name,
            } as Prisma.InputJsonValue,
          },
        ],
      });

      await this.prisma.outboxMessage.create({
        data: {
          tenantId: tenant.id,
          templateId: 'owner.invite.link',
          recipient: normalizedEmail,
          payload: {
            tenantId: tenant.id,
            tenantName: data.churchName,
            loginUrl: '/login',
            trialEndsAt: trialEndsAt.toISOString(),
          } as Prisma.InputJsonValue,
          status: 'Pending',
        },
      });

      return {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        status: tenant.status,
        plan: tenant.plan,
        onboarding: {
          adminEmail: normalizedEmail,
          adminLoginPath: '/login',
          publicSitePath: `/${normalizedDomain}`,
          trialEndsAt: trialEndsAt.toISOString(),
          selectedPlan: selectedPlan.name,
          selectedPlanPrice: selectedPlan.price,
          ownerName: metadata.ownerName,
          ownerPhone: metadata.ownerPhone,
          country: metadata.country,
          timezone: metadata.timezone,
          currency: metadata.currency,
          denomination: metadata.denomination,
          sizeRange: metadata.sizeRange,
          loginInstruction: 'Sign in with the invited owner email to claim access.',
        },
      };
    } catch (error) {
      const prismaError = error as { code?: string; meta?: { target?: string[] | string } };
      if (prismaError.code === 'P2002') {
        const target = Array.isArray(prismaError.meta?.target)
          ? prismaError.meta.target.join(',')
          : String(prismaError.meta?.target ?? '');
        if (target.toLowerCase().includes('domain')) {
          throw new BadRequestException('Domain is already taken');
        }
        if (target.toLowerCase().includes('email')) {
          throw new BadRequestException('Admin email is already linked to another workspace');
        }
        throw new BadRequestException('A conflicting record already exists');
      }
      throw error;
    }
  }

  getPublicPlans() {
    return [
      {
        name: 'Basic',
        price: 49,
        trialDays: 14,
        description: 'Core church operations for growing ministries.',
      },
      {
        name: 'Pro',
        price: 99,
        trialDays: 14,
        description: 'Advanced workflows for multi-branch operations.',
      },
      {
        name: 'Enterprise',
        price: 199,
        trialDays: 14,
        description: 'Platform-scale governance and premium support.',
      },
    ];
  }

  async getTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        plan: true,
        branches: {
          select: { id: true, name: true, isActive: true },
        },
        roles: {
          select: { id: true },
        },
        users: {
          where: { isSuperAdmin: false },
          select: {
            id: true,
            email: true,
            status: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((tenant) => {
      const owner = tenant.users.find((user) => user.role?.name === 'Owner');
      const metadata = this.extractMetadata(tenant.features);
      const activeUserCount = tenant.users.filter((user) => user.status === 'Active').length;
      return {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        status: tenant.status,
        plan: tenant.plan,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        branchCount: tenant.branches.length,
        activeBranchCount: tenant.branches.filter((branch) => branch.isActive).length,
        userCount: tenant.users.length,
        activeUserCount,
        invitedUserCount: tenant.users.filter((user) => user.status === 'Invited').length,
        roleCount: tenant.roles.length,
        ownerEmail: owner?.email ?? null,
        ownerName: metadata.ownerName,
        country: metadata.country,
        timezone: metadata.timezone,
        currency: metadata.currency,
        denomination: metadata.denomination,
        sizeRange: metadata.sizeRange,
        branchPreview: tenant.branches.slice(0, 3).map((branch) => branch.name),
      };
    });
  }

  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        branches: {
          orderBy: { name: 'asc' },
        },
        roles: {
          include: {
            _count: {
              select: { users: true },
            },
          },
          orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        },
        users: {
          where: { isSuperAdmin: false },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            branchScopeMode: true,
            lastSignInProvider: true,
            lastLoginAt: true,
            createdAt: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            role: {
              select: { id: true, name: true, isSystem: true, permissions: true },
            },
          },
        },
      },
    });
    if (!tenant) {
      return null;
    }

    const owner = tenant.users.find((user) => user.role?.name === 'Owner');
    const metadata = this.extractMetadata(tenant.features);
    const userStatusDistribution = {
      invited: tenant.users.filter((user) => user.status === 'Invited').length,
      active: tenant.users.filter((user) => user.status === 'Active').length,
      suspended: tenant.users.filter((user) => user.status === 'Suspended').length,
    };

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      status: tenant.status,
      plan: tenant.plan,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      branchCount: tenant.branches.length,
      activeBranchCount: tenant.branches.filter((branch) => branch.isActive).length,
      userCount: tenant.users.length,
      activeUserCount: userStatusDistribution.active,
      roleCount: tenant.roles.length,
      ownerEmail: owner?.email ?? null,
      ownerName: metadata.ownerName,
      profile: metadata,
      userStatusDistribution,
      roleDistribution: tenant.roles.map((role) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        permissionsCount: role.permissions.length,
        userCount: role._count.users,
      })),
      branches: tenant.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        location: branch.location,
        isActive: branch.isActive,
        createdAt: branch.createdAt,
      })),
      users: tenant.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        branchScopeMode: user.branchScopeMode,
        lastSignInProvider: user.lastSignInProvider,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              isSystem: user.role.isSystem,
              permissionsCount: user.role.permissions.length,
            }
          : null,
        defaultBranch: user.branch,
      })),
    };
  }

  async getTenantBranches(tenantId: string) {
    await this.assertTenantExists(tenantId);
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    const withStats = await Promise.all(
      branches.map(async (branch) => {
        const [members, services, attendance, users] = await Promise.all([
          this.prisma.member.count({ where: { tenantId, branchId: branch.id } }),
          this.prisma.service.count({ where: { tenantId, branchId: branch.id } }),
          this.prisma.attendance.count({ where: { tenantId, branchId: branch.id } }),
          this.prisma.user.count({
            where: {
              tenantId,
              isSuperAdmin: false,
              OR: [{ branchId: branch.id }, { branchAccess: { some: { branchId: branch.id } } }],
            },
          }),
        ]);

        return {
          id: branch.id,
          name: branch.name,
          location: branch.location,
          isActive: branch.isActive,
          createdAt: branch.createdAt,
          updatedAt: branch.updatedAt,
          stats: {
            members,
            services,
            attendance,
            users,
          },
        };
      }),
    );

    return {
      items: withStats,
      total: withStats.length,
    };
  }

  async getTenantUsers(tenantId: string) {
    await this.assertTenantExists(tenantId);
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        isSuperAdmin: false,
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
            permissions: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        branchAccess: {
          include: {
            branch: {
              select: {
                id: true,
                tenantId: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return {
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        branchScopeMode: user.branchScopeMode,
        lastSignInProvider: user.lastSignInProvider,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              isSystem: user.role.isSystem,
              permissionsCount: user.role.permissions.length,
            }
          : null,
        defaultBranch: user.branch,
        allowedBranches:
          user.branchScopeMode === 'RESTRICTED'
            ? user.branchAccess
                .filter((entry) => entry.branch.tenantId === tenantId)
                .map((entry) => ({
                  id: entry.branch.id,
                  name: entry.branch.name,
                  isActive: entry.branch.isActive,
                }))
            : [],
      })),
      total: users.length,
    };
  }

  async getTenantRoles(tenantId: string) {
    await this.assertTenantExists(tenantId);
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return {
      items: roles.map((role) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        permissionsCount: role.permissions.length,
        usersAssigned: role._count.users,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
      total: roles.length,
    };
  }

  async getTenantAuditPreview(tenantId: string, limit?: number) {
    await this.assertTenantExists(tenantId);
    const parsedLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : 12;
    const safeLimit = Math.max(1, Math.min(40, Math.floor(parsedLimit)));
    const items = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        resource: item.resource,
        details: item.details,
        ipAddress: item.ipAddress,
        createdAt: item.createdAt,
        user: item.user,
      })),
      total: items.length,
    };
  }

  async recordImpersonationAudit(
    tenantId: string,
    action: 'IMPERSONATION_START' | 'IMPERSONATION_END',
    details: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        action,
        resource: 'Tenant',
        details: details as Prisma.InputJsonValue,
      },
    });
  }

  async getPlatformMetrics() {
    const totalChurches = await this.prisma.tenant.count();
    const activeChurches = await this.prisma.tenant.count({
      where: { status: 'Active' },
    });
    
    // Sum of prices of all active tenants' plans (simulated MRR)
    const activeTenantsWithPlans = await this.prisma.tenant.findMany({
      where: { status: 'Active' },
      include: { plan: true },
    });

    const mrr = activeTenantsWithPlans.reduce((acc, t) => acc + (t.plan?.price || 0), 0);

    return {
      totalChurches,
      activeChurches,
      mrr,
    };
  }

  async updateTenantStatus(id: string, status: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { status },
    });
  }

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
