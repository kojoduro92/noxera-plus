import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const prisma = {
    branch: {
      findFirst: jest.fn(),
    },
    member: {
      findMany: jest.fn(),
    },
    attendance: {
      findMany: jest.fn(),
    },
    givingTransaction: {
      findMany: jest.fn(),
    },
    group: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
  });

  it('builds giving summary report', async () => {
    prisma.givingTransaction.findMany.mockResolvedValueOnce([
      { id: 'g-1', amount: 50, fund: 'Tithe', method: 'Cash', transactionDate: new Date() },
      { id: 'g-2', amount: 30, fund: 'Offering', method: 'Card', transactionDate: new Date() },
    ]);

    const report = await service.getGivingSummaryReport('tenant-1', undefined, '30');

    expect(report.summary.totalAmount).toBe(80);
    expect(report.summary.transactionCount).toBe(2);
    expect(report.summary.byFund.Tithe).toBe(50);
  });

  it('builds group engagement report', async () => {
    prisma.group.findMany.mockResolvedValueOnce([
      { id: 'group-1', name: 'Youth', type: 'Ministry', _count: { members: 7 } },
      { id: 'group-2', name: 'Choir', type: 'Department', _count: { members: 5 } },
    ]);

    const report = await service.getGroupEngagementReport('tenant-1');

    expect(report.summary.groupCount).toBe(2);
    expect(report.summary.totalMemberships).toBe(12);
    expect(report.items[0].name).toBe('Youth');
  });
});
