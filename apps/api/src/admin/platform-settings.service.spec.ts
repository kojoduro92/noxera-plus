import { Test, TestingModule } from '@nestjs/testing';
import { PlatformSettingsService } from './platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;

  const prisma = {
    platformSetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    featureFlag: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    outboxMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
    jest.clearAllMocks();
  });

  it('returns defaults when platform settings not stored', async () => {
    prisma.platformSetting.findUnique.mockResolvedValue(null);
    prisma.platformSetting.create.mockResolvedValue({ id: 'setting-1' });

    const result = await service.getPlatformSettings();

    expect(result.platformProfile.orgName).toBe('Noxera Plus');
    expect(prisma.platformSetting.create).toHaveBeenCalled();
  });

  it('updates a release flag', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue({
      id: 'flag-1',
      key: 'FEATURE_NOTIFICATIONS_V1',
      enabled: false,
      rolloutStage: 'internal',
      tenantCohort: [],
    });
    prisma.featureFlag.update.mockResolvedValue({
      id: 'flag-1',
      key: 'FEATURE_NOTIFICATIONS_V1',
      enabled: true,
      rolloutStage: 'internal',
      tenantCohort: [],
    });
    prisma.outboxMessage.create.mockResolvedValue({ id: 'outbox-1' });

    const result = await service.updateReleaseFlag('FEATURE_NOTIFICATIONS_V1', { enabled: true }, 'sa@noxera.plus');

    expect(result.enabled).toBe(true);
    expect(prisma.featureFlag.update).toHaveBeenCalled();
  });
});
