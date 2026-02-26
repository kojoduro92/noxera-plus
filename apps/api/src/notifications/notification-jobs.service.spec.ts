import { NotificationJobsService } from './notification-jobs.service';

describe('NotificationJobsService', () => {
  const originalEnv = { ...process.env };

  const createPrismaMock = () =>
    ({
      outboxMessage: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      platformSetting: {
        findUnique: jest.fn(),
      },
      reminderSchedule: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findMany: jest.fn(),
      },
      notification: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    }) as any;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, NOTIFICATION_JOBS_ENABLED: '1' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('marks pending outbox messages as sent in log delivery mode', async () => {
    const prisma = createPrismaMock();
    prisma.outboxMessage.findMany.mockResolvedValue([
      {
        id: 'outbox-1',
        tenantId: 'tenant-1',
        templateId: 'owner.invite.link',
        recipient: 'owner@example.com',
        payload: {},
        retryCount: 0,
        updatedAt: new Date(Date.now() - 60_000),
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);
    prisma.outboxMessage.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxMessage.update.mockResolvedValue({ id: 'outbox-1' });

    const service = new NotificationJobsService(prisma);
    await service.runOutboxWorkerOnce();

    expect(prisma.outboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-1' },
        data: expect.objectContaining({ status: 'Sent' }),
      }),
    );
  });

  it('requeues outbox messages on delivery failure until max retries', async () => {
    process.env.OUTBOX_WEBHOOK_URL = 'https://example.com/outbox';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    } as any);

    const prisma = createPrismaMock();
    prisma.outboxMessage.findMany.mockResolvedValue([
      {
        id: 'outbox-2',
        tenantId: 'tenant-1',
        templateId: 'user.invite.link',
        recipient: 'staff@example.com',
        payload: {},
        retryCount: 0,
        updatedAt: new Date(Date.now() - 60_000),
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);
    prisma.outboxMessage.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxMessage.update.mockResolvedValue({ id: 'outbox-2' });

    const service = new NotificationJobsService(prisma);
    await service.runOutboxWorkerOnce();

    expect(prisma.outboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-2' },
        data: expect.objectContaining({
          status: 'Pending',
          retryCount: 1,
        }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it('creates trial reminders and queues outbox messages for due tenants', async () => {
    const prisma = createPrismaMock();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tenantCreatedAt = new Date(today);
    tenantCreatedAt.setDate(tenantCreatedAt.getDate() - 11); // default 14-day trial => 3 days left

    prisma.platformSetting.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'notification_policy') {
        return Promise.resolve({
          value: {
            channels: { inApp: true, email: true },
            renewalCadenceDays: [3],
            categories: {
              trialMilestone: { inApp: true, email: true },
              renewalReminder: { inApp: true, email: true },
            },
          },
        });
      }

      if (where.key === 'billing_policy') {
        return Promise.resolve({
          value: {
            defaultTrialDays: 14,
            reminderCadenceDays: [3],
          },
        });
      }

      return Promise.resolve(null);
    });

    prisma.reminderSchedule.findMany
      .mockResolvedValueOnce([
        { eventType: 'trial.expiry', triggerOffsetDays: 3 },
        { eventType: 'subscription.renewal', triggerOffsetDays: 3 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'schedule-1',
          eventType: 'trial.expiry',
          triggerOffsetDays: 3,
          lastTriggeredAt: null,
          nextTriggerAt: null,
        },
      ]);

    prisma.tenant.findMany.mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Grace Church',
        domain: 'grace',
        status: 'Active',
        createdAt: tenantCreatedAt,
        users: [{ id: 'user-1', email: 'owner@grace.com' }],
      },
    ]);

    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    prisma.outboxMessage.findFirst.mockResolvedValue(null);
    prisma.outboxMessage.create.mockResolvedValue({ id: 'outbox-3' });
    prisma.reminderSchedule.update.mockResolvedValue({ id: 'schedule-1' });

    const service = new NotificationJobsService(prisma);
    await service.runReminderWorkerOnce();

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.outboxMessage.create).toHaveBeenCalledTimes(1);
    expect(prisma.reminderSchedule.update).toHaveBeenCalled();
  });
});
