import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { AuthService } from '../auth/auth.service';

describe('TenantsController', () => {
  let controller: TenantsController;
  const tenantsService = {
    createTenant: jest.fn(),
    getTenants: jest.fn(),
    getPlatformMetrics: jest.fn(),
    getTenantById: jest.fn(),
    updateTenantStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: tenantsService,
        },
        {
          provide: SuperAdminGuard,
          useValue: { canActivate: () => true },
        },
        {
          provide: AuthService,
          useValue: {
            verifySession: jest.fn(),
            isSuperAdmin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates a tenant', async () => {
    const payload = { churchName: 'Grace', domain: 'grace', plan: 'Pro', adminEmail: 'admin@grace.com' };
    tenantsService.createTenant.mockResolvedValue({ id: 'tenant-1', ...payload });

    await expect(controller.createTenant(payload)).resolves.toMatchObject({ id: 'tenant-1' });
    expect(tenantsService.createTenant).toHaveBeenCalledWith(payload);
  });

  it('updates tenant status', async () => {
    tenantsService.updateTenantStatus.mockResolvedValue({ id: 'tenant-1', status: 'Suspended' });

    await expect(controller.updateTenantStatus('tenant-1', { status: 'Suspended' })).resolves.toEqual({
      id: 'tenant-1',
      status: 'Suspended',
    });
    expect(tenantsService.updateTenantStatus).toHaveBeenCalledWith('tenant-1', 'Suspended');
  });
});
