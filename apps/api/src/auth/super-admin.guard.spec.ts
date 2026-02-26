import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';
import { AuthService } from './auth.service';

describe('SuperAdminGuard', () => {
  const authService: Pick<AuthService, 'verifySession' | 'isSuperAdmin'> = {
    verifySession: jest.fn(),
    isSuperAdmin: jest.fn(),
  };
  const guard = new SuperAdminGuard(authService as AuthService);

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

  it('denies non-super-admin users', async () => {
    (authService.verifySession as jest.Mock).mockResolvedValue({ uid: 'uid-1', email: 'user@noxera.plus' });
    (authService.isSuperAdmin as jest.Mock).mockReturnValue(false);

    await expect(
      guard.canActivate(createExecutionContext({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches super admin context when allowed', async () => {
    (authService.verifySession as jest.Mock).mockResolvedValue({ uid: 'uid-1', email: 'admin@noxera.plus' });
    (authService.isSuperAdmin as jest.Mock).mockReturnValue(true);

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request.superAdmin).toEqual({ uid: 'uid-1', email: 'admin@noxera.plus' });
  });
});
