import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class AuthService {
  private readonly superAdmins = (process.env.SUPER_ADMIN_EMAILS ?? 'kojoduro92@gmail.com,superadmin@noxera.plus')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  async verifySession(token: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }

  isSuperAdmin(email: string | undefined): boolean {
    if (!email) return false;
    return this.superAdmins.includes(email.toLowerCase());
  }
}
