import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    resolveSession: jest.fn(),
    resolveImpersonationSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('throws when token is missing', async () => {
    await expect(controller.createSession(undefined as unknown as string)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns session payload for verified super admin token', async () => {
    authService.resolveSession.mockResolvedValue({
      uid: 'uid-1',
      email: 'admin@noxera.plus',
      isSuperAdmin: true,
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantName: 'Grace',
      roleId: 'role-1',
      roleName: 'Owner',
      permissions: ['users.manage'],
      defaultBranchId: 'branch-1',
      userStatus: 'Active',
      branchScopeMode: 'ALL',
      allowedBranchIds: [],
      signInProvider: 'google.com',
    });

    await expect(controller.createSession('valid-token')).resolves.toEqual({
      message: 'Session valid',
      uid: 'uid-1',
      email: 'admin@noxera.plus',
      isSuperAdmin: true,
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantName: 'Grace',
      roleId: 'role-1',
      roleName: 'Owner',
      permissions: ['users.manage'],
      defaultBranchId: 'branch-1',
      userStatus: 'Active',
      branchScopeMode: 'ALL',
      allowedBranchIds: [],
      signInProvider: 'google.com',
    });
  });

  it('returns impersonation session payload', async () => {
    authService.resolveImpersonationSession.mockResolvedValue({
      session: {
        uid: 'impersonation:tenant-1',
        email: 'super@noxera.plus',
        isSuperAdmin: false,
        userId: null,
        tenantId: 'tenant-1',
        tenantName: 'Grace Church',
        roleId: null,
        roleName: 'Impersonation',
        permissions: ['*'],
        defaultBranchId: null,
        userStatus: 'Active',
        branchScopeMode: 'ALL',
        allowedBranchIds: [],
        signInProvider: 'impersonation',
      },
      impersonation: {
        superAdminEmail: 'super@noxera.plus',
        tenantId: 'tenant-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-01T00:30:00.000Z',
      },
    });

    await expect(controller.createImpersonationSession('imp-token')).resolves.toEqual({
      message: 'Impersonation session valid',
      uid: 'impersonation:tenant-1',
      email: 'super@noxera.plus',
      isSuperAdmin: false,
      userId: null,
      tenantId: 'tenant-1',
      tenantName: 'Grace Church',
      roleId: null,
      roleName: 'Impersonation',
      permissions: ['*'],
      defaultBranchId: null,
      userStatus: 'Active',
      branchScopeMode: 'ALL',
      allowedBranchIds: [],
      signInProvider: 'impersonation',
      impersonation: {
        superAdminEmail: 'super@noxera.plus',
        tenantId: 'tenant-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-01T00:30:00.000Z',
      },
    });
  });
});
