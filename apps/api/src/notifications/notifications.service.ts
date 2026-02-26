import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination } from '../admin/admin.types';

type NotificationFilters = {
  page?: unknown;
  limit?: unknown;
  severity?: unknown;
  unreadOnly?: unknown;
};

type NotificationContext = {
  tenantId: string;
  userId: string | null;
  email: string | null;
};

type PlatformNotificationContext = {
  email: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenantNotifications(context: NotificationContext, filters: NotificationFilters = {}) {
    const pagination = getPagination(filters);
    const severity = typeof filters.severity === 'string' ? filters.severity.trim().toLowerCase() : '';
    const unreadOnly =
      (typeof filters.unreadOnly === 'string' && ['1', 'true', 'yes'].includes(filters.unreadOnly.trim().toLowerCase())) ||
      filters.unreadOnly === true;

    const where = {
      tenantId: context.tenantId,
      scope: 'tenant',
      ...(severity ? { severity } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
      OR: [
        { targetUserId: context.userId ?? '__none__' },
        { targetEmail: context.email ?? '__none__' },
        { AND: [{ targetUserId: null }, { targetEmail: null }] },
      ],
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          ...where,
          readAt: null,
        },
      }),
      this.prisma.notification.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      unreadCount,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  async listPlatformNotifications(context: PlatformNotificationContext, filters: NotificationFilters = {}) {
    const pagination = getPagination(filters);
    const severity = typeof filters.severity === 'string' ? filters.severity.trim().toLowerCase() : '';
    const unreadOnly =
      (typeof filters.unreadOnly === 'string' && ['1', 'true', 'yes'].includes(filters.unreadOnly.trim().toLowerCase())) ||
      filters.unreadOnly === true;

    const where = {
      scope: 'platform',
      ...(severity ? { severity } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
      OR: [{ targetEmail: context.email ?? '__none__' }, { targetEmail: null }],
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          ...where,
          readAt: null,
        },
      }),
      this.prisma.notification.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      unreadCount,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  async markTenantNotificationRead(context: NotificationContext, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId: context.tenantId,
        scope: 'tenant',
        OR: [
          { targetUserId: context.userId ?? '__none__' },
          { targetEmail: context.email ?? '__none__' },
          { AND: [{ targetUserId: null }, { targetEmail: null }] },
        ],
      },
      select: { id: true, readAt: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found for this account.');
    }

    if (notification.readAt) {
      return { success: true, id: notification.id, readAt: notification.readAt };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true },
    });

    return { success: true, ...updated };
  }

  async markPlatformNotificationRead(context: PlatformNotificationContext, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        scope: 'platform',
        OR: [{ targetEmail: context.email ?? '__none__' }, { targetEmail: null }],
      },
      select: { id: true, readAt: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found for this account.');
    }

    if (notification.readAt) {
      return { success: true, id: notification.id, readAt: notification.readAt };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true },
    });

    return { success: true, ...updated };
  }

  async markAllTenantNotificationsRead(context: NotificationContext) {
    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId: context.tenantId,
        scope: 'tenant',
        readAt: null,
        OR: [
          { targetUserId: context.userId ?? '__none__' },
          { targetEmail: context.email ?? '__none__' },
          { AND: [{ targetUserId: null }, { targetEmail: null }] },
        ],
      },
      data: { readAt: new Date() },
    });

    return { success: true, updated: result.count };
  }

  async markAllPlatformNotificationsRead(context: PlatformNotificationContext) {
    const result = await this.prisma.notification.updateMany({
      where: {
        scope: 'platform',
        readAt: null,
        OR: [{ targetEmail: context.email ?? '__none__' }, { targetEmail: null }],
      },
      data: { readAt: new Date() },
    });

    return { success: true, updated: result.count };
  }

  async createNotification(input: {
    tenantId?: string | null;
    scope: 'tenant' | 'platform';
    type: string;
    title: string;
    body: string;
    severity?: 'info' | 'warning' | 'critical' | 'success';
    targetUserId?: string | null;
    targetEmail?: string | null;
    meta?: Record<string, unknown>;
  }) {
    if (input.scope === 'tenant' && !input.tenantId) {
      throw new BadRequestException('tenantId is required for tenant notifications.');
    }

    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId ?? null,
        scope: input.scope,
        type: input.type,
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'info',
        targetUserId: input.targetUserId ?? null,
        targetEmail: input.targetEmail?.trim().toLowerCase() ?? null,
        meta: (input.meta as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async enqueueOutboxMessage(input: {
    tenantId?: string | null;
    templateId: string;
    recipient: string;
    payload?: Record<string, unknown>;
    status?: string;
    error?: string;
  }) {
    return this.prisma.outboxMessage.create({
      data: {
        tenantId: input.tenantId ?? null,
        templateId: input.templateId,
        recipient: input.recipient.trim().toLowerCase(),
        payload: (input.payload as Prisma.InputJsonValue | undefined) ?? undefined,
        status: input.status ?? 'Pending',
        error: input.error ?? null,
      },
    });
  }
}
