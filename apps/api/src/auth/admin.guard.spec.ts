import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('AdminGuard', () => {
  const authService: Pick<AuthService, 'resolveSession' | 'isImpersonationToken' | 'resolveImpersonationSession'> = {
    resolveSession: jest.fn(),
    isImpersonationToken: jest.fn(),
    resolveImpersonationSession: jest.fn(),
  };
  const guard = new AdminGuard(authService as AuthService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createExecutionContext(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('denies requests without auth token', async () => {
    await expect(guard.canActivate(createExecutionContext({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('denies super-admin sessions for admin routes', async () => {
    (authService.isImpersonationToken as jest.Mock).mockReturnValue(false);
    (authService.resolveSession as jest.Mock).mockResolvedValue({ isSuperAdmin: true });

    await expect(
      guard.canActivate(createExecutionContext({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies unlinked admin accounts', async () => {
    (authService.isImpersonationToken as jest.Mock).mockReturnValue(false);
    (authService.resolveSession as jest.Mock).mockResolvedValue({
      isSuperAdmin: false,
      userId: null,
      tenantId: null,
    });

    await expect(
      guard.canActivate(createExecutionContext({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches auth context for linked admin account', async () => {
    (authService.isImpersonationToken as jest.Mock).mockReturnValue(false);
    const session = {
      uid: 'uid-1',
      email: 'admin@noxera.plus',
      isSuperAdmin: false,
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantName: 'Grace',
      roleId: null,
      roleName: null,
      permissions: [],
      defaultBranchId: null,
      userStatus: 'Active',
      branchScopeMode: 'ALL',
      allowedBranchIds: [],
      signInProvider: 'google.com',
    };

    (authService.resolveSession as jest.Mock).mockResolvedValue(session);

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect((request as { authContext?: unknown }).authContext).toEqual(session);
  });

  it('allows impersonation tokens and attaches impersonation info', async () => {
    (authService.isImpersonationToken as jest.Mock).mockReturnValue(true);
    const session = {
      uid: 'impersonation:tenant-1',
      email: 'super@noxera.plus',
      isSuperAdmin: false,
      userId: null,
      tenantId: 'tenant-1',
      tenantName: 'Grace',
      roleId: null,
      roleName: 'Impersonation',
      permissions: ['*'],
      defaultBranchId: null,
      userStatus: 'Active',
      branchScopeMode: 'ALL',
      allowedBranchIds: [],
      signInProvider: 'impersonation',
    };
    const impersonation = {
      superAdminEmail: 'super@noxera.plus',
      tenantId: 'tenant-1',
      startedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:30:00.000Z',
    };
    (authService.resolveImpersonationSession as jest.Mock).mockResolvedValue({ session, impersonation });

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer imp_token' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect((request as { authContext?: unknown }).authContext).toEqual(session);
    expect((request as { impersonation?: unknown }).impersonation).toEqual(impersonation);
  });

  it('denies suspended user sessions', async () => {
    (authService.isImpersonationToken as jest.Mock).mockReturnValue(false);
    (authService.resolveSession as jest.Mock).mockResolvedValue({
      isSuperAdmin: false,
      userId: 'user-1',
      tenantId: 'tenant-1',
      userStatus: 'Suspended',
      branchScopeMode: 'ALL',
      allowedBranchIds: [],
    });

    await expect(
      guard.canActivate(createExecutionContext({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
