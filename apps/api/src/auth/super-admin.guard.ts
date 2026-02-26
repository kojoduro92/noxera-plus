import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestWithAuth } from './auth.types';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const session = await this.authService.resolveSession(token);
    if (!session.isSuperAdmin) {
      throw new ForbiddenException('Access denied: Super Admin privileges required');
    }

    request.superAdmin = {
      uid: session.uid,
      email: session.email,
    };

    return true;
  }
}
