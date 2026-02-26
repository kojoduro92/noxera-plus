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
    getTenantBranches: jest.fn(),
    getTenantUsers: jest.fn(),
    getTenantRoles: jest.fn(),
    getTenantAuditPreview: jest.fn(),
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
    const payload = { churchName: 'Grace', domain: 'grace', plan: 'Pro', adminEmail: 'admin@grace.com', ownerName: 'Grace Owner' };
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

  it('returns tenant branches', async () => {
    tenantsService.getTenantBranches.mockResolvedValue({ items: [{ id: 'branch-1' }], total: 1 });
    await expect(controller.getTenantBranches('tenant-1')).resolves.toEqual({
      items: [{ id: 'branch-1' }],
      total: 1,
    });
    expect(tenantsService.getTenantBranches).toHaveBeenCalledWith('tenant-1');
  });

  it('returns tenant users', async () => {
    tenantsService.getTenantUsers.mockResolvedValue({ items: [{ id: 'user-1' }], total: 1 });
    await expect(controller.getTenantUsers('tenant-1')).resolves.toEqual({
      items: [{ id: 'user-1' }],
      total: 1,
    });
    expect(tenantsService.getTenantUsers).toHaveBeenCalledWith('tenant-1');
  });

  it('returns tenant roles', async () => {
    tenantsService.getTenantRoles.mockResolvedValue({ items: [{ id: 'role-1' }], total: 1 });
    await expect(controller.getTenantRoles('tenant-1')).resolves.toEqual({
      items: [{ id: 'role-1' }],
      total: 1,
    });
    expect(tenantsService.getTenantRoles).toHaveBeenCalledWith('tenant-1');
  });

  it('returns tenant audit preview', async () => {
    tenantsService.getTenantAuditPreview.mockResolvedValue({ items: [{ id: 'audit-1' }], total: 1 });
    await expect(controller.getTenantAuditPreview('tenant-1', '8')).resolves.toEqual({
      items: [{ id: 'audit-1' }],
      total: 1,
    });
    expect(tenantsService.getTenantAuditPreview).toHaveBeenCalledWith('tenant-1', 8);
  });
});
