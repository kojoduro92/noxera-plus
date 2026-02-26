import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    verifySession: jest.fn(),
    isSuperAdmin: jest.fn(),
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
    authService.verifySession.mockResolvedValue({ uid: 'uid-1', email: 'admin@noxera.plus' });
    authService.isSuperAdmin.mockReturnValue(true);

    await expect(controller.createSession('valid-token')).resolves.toEqual({
      message: 'Session valid',
      uid: 'uid-1',
      email: 'admin@noxera.plus',
      isSuperAdmin: true,
    });
  });
});
