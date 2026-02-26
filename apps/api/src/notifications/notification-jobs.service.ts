import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';

const NOTIFICATION_POLICY_KEY = 'notification_policy';
const BILLING_POLICY_KEY = 'billing_policy';

const DEFAULT_NOTIFICATION_POLICY = {
  channels: {
    inApp: true,
    email: true,
  },
  renewalCadenceDays: [7, 3, 1],
  categories: {
    trialMilestone: { inApp: true, email: true },
    renewalReminder: { inApp: true, email: true },
  },
};

const DEFAULT_BILLING_POLICY = {
  defaultTrialDays: 14,
  reminderCadenceDays: [7, 3, 1],
};

type ReminderCategory = 'trialMilestone' | 'renewalReminder';

type NotificationPolicy = {
  channels?: {
    inApp?: boolean;
    email?: boolean;
  };
  renewalCadenceDays?: unknown;
  categories?: Record<string, { inApp?: boolean; email?: boolean }>;
};

type BillingPolicy = {
  defaultTrialDays?: number;
  reminderCadenceDays?: unknown;
};

type ReminderContext = {
  tenantId: string;
  tenantName: string;
  domain: string | null;
  eventType: string;
  offsetDays: number;
  dueDate: Date;
};

@Injectable()
export class NotificationJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationJobsService.name);
  private outboxTimer: NodeJS.Timeout | null = null;
  private reminderTimer: NodeJS.Timeout | null = null;
  private outboxRunning = false;
  private reminderRunning = false;

  private readonly jobsEnabled = this.resolveBooleanEnv('NOTIFICATION_JOBS_ENABLED', process.env.NODE_ENV !== 'test');
  private readonly outboxIntervalMs = this.resolveNumberEnv('OUTBOX_WORKER_INTERVAL_MS', 30_000);
  private readonly reminderIntervalMs = this.resolveNumberEnv('REMINDER_WORKER_INTERVAL_MS', 10 * 60_000);
  private readonly outboxBatchSize = this.resolveNumberEnv('OUTBOX_WORKER_BATCH_SIZE', 20);
  private readonly outboxMaxRetries = this.resolveNumberEnv('OUTBOX_MAX_RETRIES', 5);
  private readonly retryBaseSeconds = this.resolveNumberEnv('OUTBOX_RETRY_BASE_SECONDS', 30);
  private readonly outboxWebhookUrl = process.env.OUTBOX_WEBHOOK_URL?.trim() ?? '';
  private readonly outboxWebhookToken = process.env.OUTBOX_WEBHOOK_TOKEN?.trim() ?? '';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.jobsEnabled) {
      this.logger.log('Notification jobs disabled.');
      return;
    }

    this.logger.log(
      `Notification jobs enabled (outbox=${this.outboxIntervalMs}ms, reminders=${this.reminderIntervalMs}ms).`,
    );
    this.outboxTimer = setInterval(() => {
      void this.runOutboxWorkerOnce();
    }, this.outboxIntervalMs);
    this.reminderTimer = setInterval(() => {
      void this.runReminderWorkerOnce();
    }, this.reminderIntervalMs);

    // Kick off one cycle on boot so pending jobs are not delayed.
    void this.runOutboxWorkerOnce();
    void this.runReminderWorkerOnce();
  }

  onModuleDestroy() {
    if (this.outboxTimer) {
      clearInterval(this.outboxTimer);
      this.outboxTimer = null;
    }
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }

  async runOutboxWorkerOnce() {
    if (!this.jobsEnabled || this.outboxRunning) {
      return;
    }

    this.outboxRunning = true;
    try {
      const processed = await this.processOutboxBatch();
      if (processed > 0) {
        this.logger.log(`Outbox worker processed ${processed} message(s).`);
      }
    } catch (error) {
      this.logger.error(`Outbox worker failed: ${this.toErrorMessage(error)}`);
    } finally {
      this.outboxRunning = false;
    }
  }

  async runReminderWorkerOnce() {
    if (!this.jobsEnabled || this.reminderRunning) {
      return;
    }

    this.reminderRunning = true;
    try {
      await this.ensureReminderSchedules();
      const triggered = await this.triggerDueReminders();
      if (triggered > 0) {
        this.logger.log(`Reminder worker triggered ${triggered} reminder(s).`);
      }
    } catch (error) {
      this.logger.error(`Reminder worker failed: ${this.toErrorMessage(error)}`);
    } finally {
      this.reminderRunning = false;
    }
  }

  private async processOutboxBatch() {
    const now = new Date();
    const pending = await this.prisma.outboxMessage.findMany({
      where: {
        status: 'Pending',
        retryCount: { lt: this.outboxMaxRetries },
      },
      orderBy: [{ createdAt: 'asc' }],
      take: this.outboxBatchSize,
    });

    let processed = 0;
    for (const message of pending) {
      if (!this.isRetryDue(message.updatedAt, message.retryCount, now)) {
        continue;
      }

      const claimed = await this.prisma.outboxMessage.updateMany({
        where: {
          id: message.id,
          status: 'Pending',
          retryCount: message.retryCount,
        },
        data: {
          status: 'Sending',
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      try {
        await this.dispatchOutboxMessage(message.id, {
          recipient: message.recipient,
          tenantId: message.tenantId,
          templateId: message.templateId,
          payload: (message.payload as Record<string, unknown> | null) ?? null,
        });
        await this.prisma.outboxMessage.update({
          where: { id: message.id },
          data: {
            status: 'Sent',
            sentAt: new Date(),
            error: null,
          },
        });
      } catch (error) {
        const nextRetryCount = message.retryCount + 1;
        const shouldFail = nextRetryCount >= this.outboxMaxRetries;
        await this.prisma.outboxMessage.update({
          where: { id: message.id },
          data: {
            status: shouldFail ? 'Failed' : 'Pending',
            retryCount: nextRetryCount,
            error: this.toErrorMessage(error).slice(0, 500),
          },
        });
      }

      processed += 1;
    }

    return processed;
  }

  private async ensureReminderSchedules() {
    const [notificationPolicy, billingPolicy] = await Promise.all([
      this.getPlatformSetting<NotificationPolicy>(NOTIFICATION_POLICY_KEY, DEFAULT_NOTIFICATION_POLICY),
      this.getPlatformSetting<BillingPolicy>(BILLING_POLICY_KEY, DEFAULT_BILLING_POLICY),
    ]);

    const defaultCadence = this.normalizeOffsets(notificationPolicy.renewalCadenceDays);
    const billingCadence = this.normalizeOffsets(billingPolicy.reminderCadenceDays);
    const offsets = Array.from(new Set([...defaultCadence, ...billingCadence])).sort((a, b) => b - a);

    if (offsets.length === 0) {
      return;
    }

    const eventTypes = ['trial.expiry', 'subscription.renewal'];
    const existing = await this.prisma.reminderSchedule.findMany({
      where: {
        scope: 'platform',
        isActive: true,
        eventType: { in: eventTypes },
      },
      select: {
        eventType: true,
        triggerOffsetDays: true,
      },
    });

    const existingKeys = new Set(
      existing
        .filter((item) => typeof item.triggerOffsetDays === 'number')
        .map((item) => `${item.eventType}:${item.triggerOffsetDays}`),
    );

    const toCreate: Array<{ eventType: string; triggerOffsetDays: number }> = [];
    for (const eventType of eventTypes) {
      for (const offset of offsets) {
        const key = `${eventType}:${offset}`;
        if (!existingKeys.has(key)) {
          toCreate.push({ eventType, triggerOffsetDays: offset });
        }
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.reminderSchedule.createMany({
        data: toCreate.map((item) => ({
          scope: 'platform',
          eventType: item.eventType,
          cadence: 'daily',
          triggerOffsetDays: item.triggerOffsetDays,
          isActive: true,
        })),
      });
    }
  }

  private async triggerDueReminders() {
    const now = new Date();
    const today = this.startOfDay(now);
    const nextDay = this.startOfDay(new Date(today.getTime() + 24 * 60 * 60 * 1000));

    const [notificationPolicy, billingPolicy, schedules, tenants] = await Promise.all([
      this.getPlatformSetting<NotificationPolicy>(NOTIFICATION_POLICY_KEY, DEFAULT_NOTIFICATION_POLICY),
      this.getPlatformSetting<BillingPolicy>(BILLING_POLICY_KEY, DEFAULT_BILLING_POLICY),
      this.prisma.reminderSchedule.findMany({
        where: {
          scope: 'platform',
          isActive: true,
          eventType: { in: ['trial.expiry', 'subscription.renewal'] },
          OR: [{ nextTriggerAt: null }, { nextTriggerAt: { lte: now } }],
        },
        orderBy: [{ eventType: 'asc' }, { triggerOffsetDays: 'desc' }],
      }),
      this.prisma.tenant.findMany({
        where: {
          status: { not: 'Cancelled' },
        },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          createdAt: true,
          users: {
            where: {
              status: { in: ['Invited', 'Active'] },
              role: { is: { name: 'Owner' } },
            },
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    if (schedules.length === 0 || tenants.length === 0) {
      return 0;
    }

    const trialDays = this.resolveTrialDays(billingPolicy.defaultTrialDays);
    let triggered = 0;

    for (const schedule of schedules) {
      const triggeredBeforeSchedule = triggered;
      const offsetDays = schedule.triggerOffsetDays ?? 0;
      for (const tenant of tenants) {
        if (tenant.users.length === 0) {
          continue;
        }

        const trialEndsAt = this.addDays(tenant.createdAt, trialDays);
        if (schedule.eventType === 'trial.expiry') {
          const daysUntilTrialEnd = this.diffInDays(trialEndsAt, today);
          if (daysUntilTrialEnd !== offsetDays) {
            continue;
          }

          const context: ReminderContext = {
            tenantId: tenant.id,
            tenantName: tenant.name,
            domain: tenant.domain,
            eventType: schedule.eventType,
            offsetDays,
            dueDate: trialEndsAt,
          };
          triggered += await this.emitReminder(context, tenant.users, notificationPolicy, 'trialMilestone');
          continue;
        }

        const todayMs = today.getTime();
        if (trialEndsAt.getTime() > todayMs) {
          continue;
        }

        const renewalDate = this.nextMonthlyDate(trialEndsAt, today);
        const daysUntilRenewal = this.diffInDays(renewalDate, today);
        if (daysUntilRenewal !== offsetDays) {
          continue;
        }

        const context: ReminderContext = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          domain: tenant.domain,
          eventType: schedule.eventType,
          offsetDays,
          dueDate: renewalDate,
        };
        triggered += await this.emitReminder(context, tenant.users, notificationPolicy, 'renewalReminder');
      }

      await this.prisma.reminderSchedule.update({
        where: { id: schedule.id },
        data: {
          lastTriggeredAt: triggered > triggeredBeforeSchedule ? now : schedule.lastTriggeredAt,
          nextTriggerAt: nextDay,
        },
      });
    }

    return triggered;
  }

  private async emitReminder(
    context: ReminderContext,
    owners: Array<{ id: string; email: string }>,
    policy: NotificationPolicy,
    category: ReminderCategory,
  ) {
    const inAppEnabled = this.isChannelEnabled(policy, category, 'inApp');
    const emailEnabled = this.isChannelEnabled(policy, category, 'email');
    if (!inAppEnabled && !emailEnabled) {
      return 0;
    }

    const dayStart = this.startOfDay(new Date());
    const reminderType = `${context.eventType}.d${context.offsetDays}`;
    const copy = this.buildReminderCopy(context);
    let created = 0;

    for (const owner of owners) {
      const email = owner.email.trim().toLowerCase();
      if (!email) {
        continue;
      }

      if (inAppEnabled) {
        const existingTenantNotification = await this.prisma.notification.findFirst({
          where: {
            tenantId: context.tenantId,
            scope: 'tenant',
            type: reminderType,
            targetEmail: email,
            createdAt: { gte: dayStart },
          },
          select: { id: true },
        });

        if (!existingTenantNotification) {
          await this.prisma.notification.create({
            data: {
              tenantId: context.tenantId,
              scope: 'tenant',
              type: reminderType,
              title: copy.title,
              body: copy.body,
              severity: copy.severity,
              targetUserId: owner.id,
              targetEmail: email,
              meta: {
                tenantId: context.tenantId,
                dueDate: context.dueDate.toISOString(),
                domain: context.domain,
              } as Prisma.InputJsonValue,
            },
          });
          created += 1;
        }
      }

      if (emailEnabled) {
        const templateId = `reminder.${context.eventType}.d${context.offsetDays}`;
        const existingOutbox = await this.prisma.outboxMessage.findFirst({
          where: {
            tenantId: context.tenantId,
            templateId,
            recipient: email,
            createdAt: { gte: dayStart },
          },
          select: { id: true },
        });

        if (!existingOutbox) {
          await this.prisma.outboxMessage.create({
            data: {
              tenantId: context.tenantId,
              templateId,
              recipient: email,
              payload: {
                tenantId: context.tenantId,
                tenantName: context.tenantName,
                domain: context.domain,
                dueDate: context.dueDate.toISOString(),
                offsetDays: context.offsetDays,
                eventType: context.eventType,
                title: copy.title,
                body: copy.body,
              } as Prisma.InputJsonValue,
              status: 'Pending',
            },
          });
          created += 1;
        }
      }
    }

    return created;
  }

  private async dispatchOutboxMessage(
    outboxId: string,
    input: {
      recipient: string;
      tenantId: string | null;
      templateId: string;
      payload: Record<string, unknown> | null;
    },
  ) {
    if (!input.recipient.trim()) {
      throw new Error('Outbox recipient is required.');
    }

    if (!this.outboxWebhookUrl) {
      this.logger.log(
        `Outbox log delivery (no webhook configured): template=${input.templateId}, recipient=${input.recipient}`,
      );
      return;
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-noxera-outbox-id': outboxId,
    };
    if (this.outboxWebhookToken) {
      headers.authorization = `Bearer ${this.outboxWebhookToken}`;
    }

    const response = await fetch(this.outboxWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: outboxId,
        tenantId: input.tenantId,
        recipient: input.recipient,
        templateId: input.templateId,
        payload: input.payload,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).trim();
      throw new Error(`Webhook delivery failed (${response.status}): ${details || response.statusText}`);
    }
  }

  private buildReminderCopy(context: ReminderContext): {
    title: string;
    body: string;
    severity: 'info' | 'warning' | 'critical';
  } {
    if (context.eventType === 'trial.expiry') {
      if (context.offsetDays > 1) {
        return {
          title: `Trial ends in ${context.offsetDays} days`,
          body: `${context.tenantName} trial ends on ${context.dueDate.toDateString()}. Review plan and billing before expiration.`,
          severity: 'warning',
        };
      }

      return {
        title: 'Trial ends tomorrow',
        body: `${context.tenantName} trial ends on ${context.dueDate.toDateString()}. Action is required to avoid interruption.`,
        severity: 'critical',
      };
    }

    if (context.offsetDays > 1) {
      return {
        title: `Renewal due in ${context.offsetDays} days`,
        body: `${context.tenantName} next subscription renewal is ${context.dueDate.toDateString()}.`,
        severity: 'info',
      };
    }

    return {
      title: 'Renewal due tomorrow',
      body: `${context.tenantName} subscription renews on ${context.dueDate.toDateString()}.`,
      severity: 'warning',
    };
  }

  private async getPlatformSetting<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
    const value = await this.prisma.platformSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (!value || typeof value.value !== 'object' || value.value === null || Array.isArray(value.value)) {
      return fallback;
    }
    return value.value as T;
  }

  private isChannelEnabled(policy: NotificationPolicy, category: ReminderCategory, channel: 'inApp' | 'email') {
    const globalEnabled = policy.channels?.[channel] ?? true;
    const categoryEnabled = policy.categories?.[category]?.[channel] ?? true;
    return Boolean(globalEnabled && categoryEnabled);
  }

  private resolveTrialDays(value: number | undefined) {
    const normalized = Number.isFinite(value) ? Number(value) : DEFAULT_BILLING_POLICY.defaultTrialDays;
    return Math.max(1, Math.floor(normalized));
  }

  private normalizeOffsets(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === 'number' ? entry : Number.parseInt(String(entry), 10)))
          .filter((entry): entry is number => Number.isFinite(entry) && entry >= 0)
          .map((entry) => Math.floor(entry)),
      ),
    );
  }

  private resolveBooleanEnv(key: string, fallback: boolean) {
    const raw = process.env[key];
    if (raw === undefined) {
      return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }

  private resolveNumberEnv(key: string, fallback: number) {
    const raw = process.env[key];
    if (!raw) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isRetryDue(updatedAt: Date, retryCount: number, now: Date) {
    if (retryCount <= 0) {
      return true;
    }

    const backoffSeconds = Math.min(60 * 60, this.retryBaseSeconds * 2 ** (retryCount - 1));
    const retryAfter = new Date(updatedAt.getTime() + backoffSeconds * 1000);
    return retryAfter.getTime() <= now.getTime();
  }

  private startOfDay(value: Date) {
    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private addDays(value: Date, days: number) {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return this.startOfDay(next);
  }

  private diffInDays(target: Date, current: Date) {
    return Math.floor((this.startOfDay(target).getTime() - this.startOfDay(current).getTime()) / (24 * 60 * 60 * 1000));
  }

  private nextMonthlyDate(anchor: Date, now: Date) {
    let next = this.startOfDay(anchor);
    const today = this.startOfDay(now);
    while (next.getTime() < today.getTime()) {
      next = this.addMonths(next, 1);
    }
    return next;
  }

  private addMonths(value: Date, months: number) {
    const next = new Date(value);
    const dayOfMonth = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    const monthLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayOfMonth, monthLastDay));
    return this.startOfDay(next);
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
