import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminSessionContext, ImpersonationSessionInfo } from './auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly impersonationTokenPrefix = 'imp_';

  private readonly superAdmins = (process.env.SUPER_ADMIN_EMAILS ?? 'kojoduro92@gmail.com,superadmin@noxera.plus')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  private readonly impersonationSecret = process.env.IMPERSONATION_SECRET ?? 'local-dev-impersonation-secret';
  private readonly impersonationDurationSeconds = Number(process.env.IMPERSONATION_DURATION_SECONDS ?? 30 * 60);

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

  async resolveSession(token: string): Promise<AdminSessionContext> {
    const decodedToken = await this.verifySession(token);
    const normalizedEmail = decodedToken.email?.trim().toLowerCase() ?? null;
    const isSuperAdmin = this.isSuperAdmin(normalizedEmail ?? undefined);
    const signInProvider = decodedToken.firebase?.sign_in_provider ?? null;

    const user = normalizedEmail
      ? await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
                permissions: true,
              },
            },
            branchAccess: {
              select: {
                branchId: true,
                branch: {
                  select: {
                    tenantId: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        })
      : null;

    let effectiveUser = user;
    if (user) {
      const now = new Date();
      if (user.status === 'Invited') {
        effectiveUser = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'Active',
            activatedAt: now,
            lastLoginAt: now,
            lastSignInProvider: signInProvider,
          },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
                permissions: true,
              },
            },
            branchAccess: {
              select: {
                branchId: true,
                branch: {
                  select: {
                    tenantId: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        });
        await this.prisma.notification
          .createMany({
            data: [
              {
                tenantId: effectiveUser.tenantId,
                scope: 'tenant',
                type: 'user.claimed',
                title: 'Account claimed successfully',
                body: `${effectiveUser.email} completed first sign-in and is now active.`,
                severity: 'success',
                targetUserId: effectiveUser.id,
                targetEmail: effectiveUser.email,
                meta: {
                  roleId: effectiveUser.roleId,
                  provider: signInProvider,
                },
              },
              {
                tenantId: null,
                scope: 'platform',
                type: 'owner.claimed',
                title: 'Owner account claimed',
                body: `${effectiveUser.email} claimed access for tenant ${effectiveUser.tenant?.name ?? 'unknown'}.`,
                severity: 'info',
                targetEmail: null,
                meta: {
                  tenantId: effectiveUser.tenantId,
                  userId: effectiveUser.id,
                },
              },
            ],
          })
          .catch(() => undefined);
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: now,
            lastSignInProvider: signInProvider,
          },
        });
      }
    }

    const branchScopeMode = effectiveUser?.branchScopeMode === 'RESTRICTED' ? 'RESTRICTED' : 'ALL';
    const allowedBranchIds =
      branchScopeMode === 'RESTRICTED'
        ? effectiveUser?.branchAccess
            ?.filter((entry) => entry.branch?.tenantId === effectiveUser?.tenantId && entry.branch?.isActive)
            .map((entry) => entry.branchId) ?? []
        : [];

    return {
      uid: decodedToken.uid,
      email: normalizedEmail,
      isSuperAdmin,
      userId: effectiveUser?.id ?? null,
      tenantId: effectiveUser?.tenantId ?? null,
      tenantName: effectiveUser?.tenant?.name ?? null,
      roleId: effectiveUser?.roleId ?? null,
      roleName: effectiveUser?.role?.name ?? null,
      permissions: effectiveUser?.role?.permissions ?? [],
      defaultBranchId: effectiveUser?.branchId ?? null,
      userStatus: effectiveUser?.status ?? null,
      branchScopeMode,
      allowedBranchIds,
      signInProvider,
    };
  }

  createImpersonationToken(superAdminEmail: string, tenantId: string): ImpersonationSessionInfo & { token: string } {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + this.impersonationDurationSeconds * 1000);
    const payload = {
      superAdminEmail: superAdminEmail.trim().toLowerCase(),
      tenantId,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const encoded = this.encodePayload(payload);
    const signature = this.sign(encoded);
    const token = `${this.impersonationTokenPrefix}${encoded}.${signature}`;

    return {
      token,
      ...payload,
    };
  }

  verifyImpersonationToken(token: string): ImpersonationSessionInfo {
    const normalizedToken = token.startsWith(this.impersonationTokenPrefix)
      ? token.slice(this.impersonationTokenPrefix.length)
      : token;
    const [encodedPayload, signature] = normalizedToken.split('.');
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid impersonation token format');
    }

    const expectedSignature = this.sign(encodedPayload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length) {
      throw new UnauthorizedException('Invalid impersonation token signature');
    }
    const matches = timingSafeEqual(signatureBuffer, expectedBuffer);
    if (!matches) {
      throw new UnauthorizedException('Invalid impersonation token signature');
    }

    let payload: ImpersonationSessionInfo;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as ImpersonationSessionInfo;
    } catch {
      throw new UnauthorizedException('Invalid impersonation token payload');
    }

    if (!payload.tenantId || !payload.superAdminEmail || !payload.expiresAt || !payload.startedAt) {
      throw new UnauthorizedException('Invalid impersonation token content');
    }

    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('Impersonation token expired');
    }

    return payload;
  }

  isImpersonationToken(token: string): boolean {
    return token.startsWith(this.impersonationTokenPrefix);
  }

  async resolveImpersonationSession(token: string): Promise<{
    session: AdminSessionContext;
    impersonation: ImpersonationSessionInfo;
  }> {
    const impersonation = this.verifyImpersonationToken(token);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: impersonation.tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('Impersonation tenant no longer exists');
    }

    return {
      session: {
        uid: `impersonation:${tenant.id}`,
        email: impersonation.superAdminEmail,
        isSuperAdmin: false,
        userId: null,
        tenantId: tenant.id,
        tenantName: tenant.name,
        roleId: null,
        roleName: 'Impersonation',
        permissions: ['*'],
        defaultBranchId: null,
        userStatus: 'Active',
        branchScopeMode: 'ALL',
        allowedBranchIds: [],
        signInProvider: 'impersonation',
      },
      impersonation,
    };
  }

  private encodePayload(payload: ImpersonationSessionInfo) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private sign(encodedPayload: string) {
    return createHmac('sha256', this.impersonationSecret).update(encodedPayload).digest('base64url');
  }
}
