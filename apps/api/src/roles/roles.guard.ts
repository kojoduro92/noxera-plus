import { ForbiddenException, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import * as admin from 'firebase-admin';
import type { RequestWithAuth } from '../auth/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions) {
      return true; // No specific permissions required, allow access
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const contextPermissions = request.authContext?.permissions ?? [];
    if (contextPermissions.includes('*')) {
      return true;
    }
    if (contextPermissions.length > 0) {
      const granted = requiredPermissions.every((perm) => contextPermissions.includes(perm));
      if (!granted) {
        throw new ForbiddenException('Insufficient permissions for this action.');
      }
      return true;
    }

    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new ForbiddenException('Missing authorization token.');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userEmail = decodedToken.email;

      const user = await this.prisma.user.findUnique({
        where: { email: userEmail },
        include: { role: true },
      });

      if (!user || !user.role) {
        throw new ForbiddenException('Role assignment missing for this account.');
      }

      const userPermissions = user.role.permissions || [];
      const granted = requiredPermissions.every((perm) => userPermissions.includes(perm));
      if (!granted) {
        throw new ForbiddenException('Insufficient permissions for this action.');
      }
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Permission check failed.');
    }
  }
}
