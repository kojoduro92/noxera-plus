import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const decodedToken = await this.authService.verifySession(token);
    if (!this.authService.isSuperAdmin(decodedToken.email)) {
      throw new ForbiddenException('Access denied: Super Admin privileges required');
    }

    request.superAdmin = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    return true;
  }
}
