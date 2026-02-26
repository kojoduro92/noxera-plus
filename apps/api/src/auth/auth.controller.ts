
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('session')
  async createSession(@Body('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const decodedToken = await this.authService.verifySession(token);
    const isSuperAdmin = this.authService.isSuperAdmin(decodedToken.email);
    
    return {
      message: 'Session valid',
      uid: decodedToken.uid,
      email: decodedToken.email,
      isSuperAdmin,
    };
  }
}
