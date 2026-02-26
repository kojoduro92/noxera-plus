import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prisma = {
    notification: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    outboxMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('returns tenant notifications with unread count', async () => {
    prisma.$transaction.mockResolvedValueOnce([
      2,
      1,
      [
        {
          id: 'notif-1',
          scope: 'tenant',
          title: 'Welcome',
          body: 'Ready',
          severity: 'info',
          createdAt: new Date(),
        },
      ],
    ]);

    const result = await service.listTenantNotifications(
      { tenantId: 'tenant-1', userId: 'user-1', email: 'owner@example.com' },
      { page: '1', limit: '25' },
    );

    expect(result.total).toBe(2);
    expect(result.unreadCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('marks all tenant notifications as read', async () => {
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 5 });

    const result = await service.markAllTenantNotificationsRead({
      tenantId: 'tenant-1',
      userId: 'user-1',
      email: 'owner@example.com',
    });

    expect(result).toEqual({ success: true, updated: 5 });
    expect(prisma.notification.updateMany).toHaveBeenCalled();
  });
});
