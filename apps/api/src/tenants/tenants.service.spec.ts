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
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates tenant with plan and optional branch', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.plan.upsert.mockResolvedValue({ id: 'plan-1' });
    prisma.tenant.create.mockResolvedValue({ id: 'tenant-1', name: 'Grace' });

    await expect(
      service.createTenant({
        churchName: 'Grace',
        domain: 'grace',
        plan: 'Pro',
        adminEmail: 'admin@grace.com',
        branchName: 'Main Campus',
      }),
    ).resolves.toEqual({ id: 'tenant-1', name: 'Grace' });

    expect(prisma.plan.upsert).toHaveBeenCalled();
    expect(prisma.tenant.create).toHaveBeenCalled();
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
