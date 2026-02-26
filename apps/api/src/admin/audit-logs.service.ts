import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AuditLog } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination, PaginatedResponse, parseDateInput } from './admin.types';

type AuditLogFilters = {
  page?: unknown;
  limit?: unknown;
  tenantId?: unknown;
  action?: unknown;
  from?: unknown;
  to?: unknown;
  search?: unknown;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(filters: AuditLogFilters): Promise<PaginatedResponse<AuditLog>> {
    const pagination = getPagination(filters);
    const where = this.buildWhere(filters);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, domain: true, status: true } },
          user: { select: { id: true, name: true, email: true } },
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

  async getAuditLogById(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, domain: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!log) {
      throw new NotFoundException('Audit log entry not found.');
    }

    return log;
  }

  async listAuditLogsByTenant(tenantId: string, filters: Pick<AuditLogFilters, 'page' | 'limit'>) {
    return this.listAuditLogs({ ...filters, tenantId });
  }

  async listImpersonationLogs(filters: Pick<AuditLogFilters, 'page' | 'limit' | 'search'>) {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';

    const where: Prisma.AuditLogWhereInput = {
      action: { startsWith: 'IMPERSONATION_', mode: 'insensitive' },
    };

    if (search) {
      where.OR = [
        { tenant: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { details: { path: ['superAdminEmail'], string_contains: search } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, domain: true } },
          user: { select: { id: true, name: true, email: true } },
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

  private buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    const tenantId = typeof filters.tenantId === 'string' ? filters.tenantId.trim() : '';
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const action = typeof filters.action === 'string' ? filters.action.trim() : '';
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const from = parseDateInput(filters.from);
    const to = parseDateInput(filters.to);
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { tenant: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { user: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    return where;
  }
}
