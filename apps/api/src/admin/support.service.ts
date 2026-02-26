import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupportTicket } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination, PaginatedResponse } from './admin.types';

const TICKET_STATUSES = ['Open', 'Pending Engineer', 'Resolved', 'Closed'] as const;
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;

type TicketListFilters = {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  tenantId?: unknown;
  priority?: unknown;
  search?: unknown;
};

type CreateTicketInput = {
  tenantId: string;
  subject: string;
  description: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
};

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(data: CreateTicketInput, actorEmail: string) {
    this.validateRequired(data.tenantId, 'tenantId');
    this.validateRequired(data.subject, 'subject');
    this.validateRequired(data.description, 'description');

    const status = (data.status?.trim() || 'Open') as (typeof TICKET_STATUSES)[number];
    const priority = (data.priority?.trim() || 'Medium') as (typeof TICKET_PRIORITIES)[number];

    if (!TICKET_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status. Allowed values: ${TICKET_STATUSES.join(', ')}`);
    }

    if (!TICKET_PRIORITIES.includes(priority)) {
      throw new BadRequestException(`Invalid priority. Allowed values: ${TICKET_PRIORITIES.join(', ')}`);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: data.tenantId,
        subject: data.subject.trim(),
        description: data.description.trim(),
        status,
        priority,
        assignedTo: data.assignedTo?.trim() || null,
      },
      include: {
        tenant: { select: { id: true, name: true, domain: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        action: 'SUPER_ADMIN_SUPPORT_TICKET_CREATED',
        resource: 'SupportTicket',
        details: {
          actorEmail,
          ticketId: ticket.id,
          priority,
          status,
        },
      },
    });

    return ticket;
  }

  async listTickets(filters: TicketListFilters): Promise<PaginatedResponse<SupportTicket>> {
    const pagination = getPagination(filters);
    const where = this.buildWhere(filters);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          tenant: { select: { id: true, name: true, domain: true, status: true } },
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

  async getTicketById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, domain: true, status: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    return ticket;
  }

  async updateStatus(id: string, status: string, actorEmail: string) {
    const normalized = status?.trim() as (typeof TICKET_STATUSES)[number];
    if (!normalized || !TICKET_STATUSES.includes(normalized)) {
      throw new BadRequestException(`Invalid status. Allowed values: ${TICKET_STATUSES.join(', ')}`);
    }

    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Support ticket not found.');
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status: normalized },
      include: {
        tenant: { select: { id: true, name: true, domain: true, status: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: ticket.tenantId,
        action: 'SUPER_ADMIN_SUPPORT_TICKET_STATUS_UPDATED',
        resource: 'SupportTicket',
        details: {
          actorEmail,
          ticketId: ticket.id,
          previousStatus: existing.status,
          status: normalized,
        },
      },
    });

    return ticket;
  }

  async assignTicket(id: string, assignedTo: string, actorEmail: string) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Support ticket not found.');
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { assignedTo: assignedTo.trim() || null },
      include: {
        tenant: { select: { id: true, name: true, domain: true, status: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: ticket.tenantId,
        action: 'SUPER_ADMIN_SUPPORT_TICKET_ASSIGNED',
        resource: 'SupportTicket',
        details: {
          actorEmail,
          ticketId: ticket.id,
          previousAssignedTo: existing.assignedTo ?? null,
          assignedTo: ticket.assignedTo ?? null,
        },
      },
    });

    return ticket;
  }

  private buildWhere(filters: TicketListFilters): Prisma.SupportTicketWhereInput {
    const where: Prisma.SupportTicketWhereInput = {};

    const status = typeof filters.status === 'string' ? filters.status.trim() : '';
    if (status) {
      where.status = status;
    }

    const tenantId = typeof filters.tenantId === 'string' ? filters.tenantId.trim() : '';
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const priority = typeof filters.priority === 'string' ? filters.priority.trim() : '';
    if (priority) {
      where.priority = priority;
    }

    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { assignedTo: { contains: search, mode: 'insensitive' } },
        { tenant: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    return where;
  }

  private validateRequired(value: string | undefined, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }
}
