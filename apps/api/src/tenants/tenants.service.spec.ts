import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('TenantsService', () => {
  let service: TenantsService;
  const prisma = {
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    plan: {
      upsert: jest.fn(),
    },
    role: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    outboxMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
    prisma.notification.createMany.mockResolvedValue({ count: 2 });
    prisma.outboxMessage.create.mockResolvedValue({ id: 'outbox-1' });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when creating a tenant with an existing domain', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 'existing-tenant' });

    await expect(
      service.createTenant({
        churchName: 'Grace',
        domain: 'grace',
        plan: 'Pro',
        adminEmail: 'admin@grace.com',
        ownerName: 'Grace Owner',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates tenant with plan and optional branch', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.plan.upsert
      .mockResolvedValueOnce({ id: 'plan-pro', name: 'Pro', price: 99 })
      .mockResolvedValueOnce({ id: 'plan-trial', name: 'Trial', price: 0 });
    prisma.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Grace',
      domain: 'grace',
      status: 'Active',
      plan: { id: 'plan-trial', name: 'Trial', price: 0 },
      users: [{ id: 'owner-1' }],
      branches: [{ id: 'branch-1' }],
    });
    prisma.role.findFirst.mockResolvedValue({ id: 'role-owner' });
    prisma.user.update.mockResolvedValue({ id: 'owner-1' });

    const result = await service.createTenant({
      churchName: 'Grace',
      domain: 'grace',
      plan: 'Pro',
      adminEmail: 'admin@grace.com',
      ownerName: 'Grace Owner',
      branchName: 'Main Campus',
    });

    expect(result).toMatchObject({
      id: 'tenant-1',
      name: 'Grace',
      domain: 'grace',
      plan: { name: 'Trial', price: 0 },
      onboarding: {
        adminEmail: 'admin@grace.com',
        adminLoginPath: '/login',
        publicSitePath: '/grace',
        selectedPlan: 'Pro',
        selectedPlanPrice: 99,
      },
    });

    expect(result.onboarding.trialEndsAt).toBeDefined();
    expect(prisma.plan.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: 'grace',
          planId: 'plan-trial',
          branches: {
            create: { name: 'Main Campus', location: 'Main Campus', isActive: true },
          },
        }),
      }),
    );
    expect(prisma.role.createMany).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: { roleId: 'role-owner', branchId: 'branch-1' },
    });
  });

  it('normalizes admin email and domain values', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.plan.upsert
      .mockResolvedValueOnce({ id: 'plan-pro', name: 'Pro', price: 99 })
      .mockResolvedValueOnce({ id: 'plan-trial', name: 'Trial', price: 0 });
    prisma.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Grace',
      domain: 'grace-city',
      status: 'Active',
      plan: { id: 'plan-trial', name: 'Trial', price: 0 },
      users: [{ id: 'owner-1' }],
      branches: [{ id: 'branch-1' }],
    });
    prisma.role.findFirst.mockResolvedValue({ id: 'role-owner' });
    prisma.user.update.mockResolvedValue({ id: 'owner-1' });

    await service.createTenant({
      churchName: 'Grace',
      domain: '  Grace City ',
      plan: 'Pro',
      adminEmail: ' Admin@Grace.COM ',
      ownerName: 'Grace Owner',
    });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { domain: 'grace-city' } });
    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: 'grace-city',
          users: {
            create: expect.objectContaining({
              email: 'admin@grace.com',
              name: 'Grace Owner',
            }),
          },
        }),
      }),
    );
  });

  it('throws if normalized domain is empty', async () => {
    await expect(
      service.createTenant({
        churchName: 'Grace',
        domain: '***',
        plan: 'Pro',
        adminEmail: 'admin@grace.com',
        ownerName: 'Grace Owner',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores onboarding metadata inside tenant features', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.plan.upsert
      .mockResolvedValueOnce({ id: 'plan-pro', name: 'Pro', price: 99 })
      .mockResolvedValueOnce({ id: 'plan-trial', name: 'Trial', price: 0 });
    prisma.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Grace',
      domain: 'grace-city',
      status: 'Active',
      plan: { id: 'plan-trial', name: 'Trial', price: 0 },
      users: [{ id: 'owner-1' }],
      branches: [{ id: 'branch-1' }],
    });
    prisma.role.findFirst.mockResolvedValue({ id: 'role-owner' });
    prisma.user.update.mockResolvedValue({ id: 'owner-1' });

    await service.createTenant({
      churchName: 'Grace',
      domain: 'grace-city',
      plan: 'Pro',
      adminEmail: 'admin@grace.com',
      ownerName: 'Grace Owner',
      country: 'GH',
      timezone: 'Africa/Accra',
      currency: 'GHS',
      denomination: 'Charismatic',
      sizeRange: '151-300',
    });

    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: expect.arrayContaining([
            expect.stringContaining('meta.owner_name:'),
            expect.stringContaining('meta.country:'),
            expect.stringContaining('meta.currency:'),
            expect.stringContaining('meta.size_range:'),
          ]),
        }),
      }),
    );
  });

  it('returns platform metrics', async () => {
    prisma.tenant.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.tenant.findMany.mockResolvedValue([
      { plan: { price: 49 } },
      { plan: { price: 99 } },
    ]);

    await expect(service.getPlatformMetrics()).resolves.toEqual({
      totalChurches: 3,
      activeChurches: 2,
      mrr: 148,
    });
  });
});
