import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Plan, Tenant } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination, PaginatedResponse } from './admin.types';

const BILLING_STATUSES = ['Active', 'Past Due', 'Suspended', 'Cancelled'] as const;
type BillingStatus = (typeof BILLING_STATUSES)[number];

type BillingTenantFilters = {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  planId?: unknown;
  search?: unknown;
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      orderBy: [{ price: 'asc' }, { name: 'asc' }],
    });
  }

  async listTenantBilling(filters: BillingTenantFilters): Promise<
    PaginatedResponse<Tenant> & {
      summary: {
        mrr: number;
        activeSubscriptions: number;
      };
    }
  > {
    const pagination = getPagination(filters);
    const where = this.buildBillingWhere(filters);

    const [total, items, activeTenants] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          plan: true,
        },
      }),
      this.prisma.tenant.findMany({
        where: {
          ...where,
          status: 'Active',
        },
        include: {
          plan: {
            select: {
              price: true,
            },
          },
        },
      }),
    ]);

    const mrr = activeTenants.reduce((sum, tenant) => sum + (tenant.plan?.price ?? 0), 0);

    return {
      items,
      page: pagination.page,
      limit: pagination.limit,
      total,
      summary: {
        mrr,
        activeSubscriptions: activeTenants.length,
      },
    };
  }

  async updateTenantPlan(tenantId: string, data: { planId?: string; planName?: string }, actorEmail: string) {
    const plan = await this.resolvePlan(data);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id },
      include: { plan: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'SUPER_ADMIN_PLAN_UPDATED',
        resource: 'Billing',
        details: {
          actorEmail,
          previousPlanId: tenant.planId ?? null,
          planId: plan.id,
          planName: plan.name,
        },
      },
    });

    return updatedTenant;
  }

  async updateTenantStatus(tenantId: string, data: { status: string }, actorEmail: string) {
    const status = data.status?.trim();
    if (!status || !BILLING_STATUSES.includes(status as BillingStatus)) {
      throw new BadRequestException(`Invalid status. Allowed values: ${BILLING_STATUSES.join(', ')}`);
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
      include: { plan: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'SUPER_ADMIN_BILLING_STATUS_UPDATED',
        resource: 'Billing',
        details: {
          actorEmail,
          previousStatus: tenant.status,
          status,
        },
      },
    });

    return updatedTenant;
  }

  private buildBillingWhere(filters: BillingTenantFilters): Prisma.TenantWhereInput {
    const where: Prisma.TenantWhereInput = {};

    const status = typeof filters.status === 'string' ? filters.status.trim() : '';
    if (status) {
      where.status = status;
    }

    const planId = typeof filters.planId === 'string' ? filters.planId.trim() : '';
    if (planId) {
      where.planId = planId;
    }

    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async resolvePlan(data: { planId?: string; planName?: string }) {
    const whereById = data.planId?.trim();
    const whereByName = data.planName?.trim();

    if (!whereById && !whereByName) {
      throw new BadRequestException('planId or planName is required.');
    }

    const where: Prisma.PlanWhereInput = whereById ? { id: whereById } : { name: whereByName };
    const plan = await this.prisma.plan.findFirst({ where });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return plan;
  }
}
