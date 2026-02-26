import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import * as admin from 'firebase-admin';

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

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      return false; // No token provided
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userEmail = decodedToken.email;

      const user = await this.prisma.user.findUnique({
        where: { email: userEmail },
        include: { role: true },
      });

      if (!user || !user.role) {
        return false; // User not found in DB or no role assigned
      }

      const userPermissions = user.role.permissions || [];
      return requiredPermissions.every((perm) => userPermissions.includes(perm));
    } catch (error) {
      console.error('Firebase token verification failed or DB lookup error:', error);
      return false;
    }
  }
}
