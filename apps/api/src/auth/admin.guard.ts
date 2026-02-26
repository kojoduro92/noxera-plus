import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { RequestWithAuth } from './auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const bearerToken = request.headers.authorization?.split(' ')[1]?.trim();

    if (!bearerToken) {
      throw new UnauthorizedException('Missing authorization token');
    }

    if (this.authService.isImpersonationToken(bearerToken)) {
      const { session, impersonation } = await this.authService.resolveImpersonationSession(bearerToken);
      request.authContext = session;
      request.impersonation = impersonation;
      return true;
    }

    const session = await this.authService.resolveSession(bearerToken);

    if (session.isSuperAdmin) {
      throw new ForbiddenException('Super-admins must use explicit impersonation to access church-admin routes.');
    }

    if (!session.userId || !session.tenantId) {
      throw new ForbiddenException('Your account is not linked to a church workspace. Contact support or onboarding admin.');
    }

    if (session.userStatus === 'Suspended') {
      throw new ForbiddenException('Your account has been suspended. Contact your church administrator.');
    }

    if (session.branchScopeMode === 'RESTRICTED' && session.allowedBranchIds.length === 0) {
      throw new ForbiddenException('Your account has no branch access assigned. Contact your church administrator.');
    }

    request.authContext = session;
    return true;
  }
}
