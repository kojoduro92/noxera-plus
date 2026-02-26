import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@noxera-plus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination } from './admin.types';

const PLATFORM_PROFILE_KEY = 'platform_profile';
const AUTH_ACCESS_POLICY_KEY = 'auth_access_policy';
const NOTIFICATION_POLICY_KEY = 'notification_policy';
const BILLING_POLICY_KEY = 'billing_policy';
const AUDIT_RETENTION_KEY = 'audit_retention_policy';
const CONTENT_HUB_KEY = 'content_hub';
const SYSTEM_MANAGEMENT_KEY = 'system_management';

type JsonObject = Record<string, unknown>;

type ReleaseFlagFilters = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
};

const DEFAULT_PLATFORM_PROFILE = {
  orgName: 'Noxera Plus',
  supportEmail: 'support@noxera.plus',
  defaultLocale: 'en-US',
  defaultTimezone: 'UTC',
  defaultCurrency: 'USD',
  defaultCountry: 'US',
  defaultLanguage: 'en',
  logoUrl: '/brand-logo.png',
  faviconUrl: '/brand-favicon.png',
  themeMode: 'system',
  brandPrimaryColor: '#d62f9d',
  brandAccentColor: '#0bb9f4',
  supportedLanguages: ['en', 'fr'],
  supportedCountries: ['US', 'CA', 'GB', 'FR', 'GH', 'NG'],
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'GHS', 'NGN'],
};

const DEFAULT_AUTH_POLICY = {
  superAdminEmails: [],
  googleEnabled: true,
  passwordEnabled: true,
  otpEnabled: false,
};

const DEFAULT_NOTIFICATION_POLICY = {
  channels: {
    inApp: true,
    email: true,
  },
  renewalCadenceDays: [7, 3, 1],
  categories: {
    trialMilestone: { inApp: true, email: true },
    renewalReminder: { inApp: true, email: true },
    securityAlert: { inApp: true, email: true },
    supportUpdate: { inApp: true, email: false },
  },
};

const DEFAULT_BILLING_POLICY = {
  defaultTrialDays: 14,
  gracePeriodDays: 7,
  reminderCadenceDays: [7, 3, 1],
};

const DEFAULT_AUDIT_RETENTION_POLICY = {
  auditLogRetentionDays: 365,
  outboxRetentionDays: 90,
  notificationRetentionDays: 180,
};

const DEFAULT_CONTENT_HUB = {
  globalAnnouncementEnabled: true,
  globalAnnouncement: {
    title: 'Welcome to Noxera Plus',
    body: 'Review release notes weekly and keep tenant onboarding playbooks updated.',
    severity: 'info',
  },
  templateLibrary: [
    { id: 'tmpl-modern-faith', name: 'Modern Faith', status: 'published' },
    { id: 'tmpl-classic-cathedral', name: 'Classic Cathedral', status: 'draft' },
    { id: 'tmpl-ministry-grid', name: 'Ministry Grid', status: 'published' },
  ],
  spotlightArticles: [
    { id: 'article-activation-guide', title: '7-day activation playbook', slug: '/docs' },
    { id: 'article-onboarding-checklist', title: 'Tenant onboarding checklist', slug: '/docs' },
  ],
};

const DEFAULT_SYSTEM_MANAGEMENT = {
  maintenanceMode: false,
  statusPageUrl: 'https://status.noxera.plus',
  backupWindow: '02:00-03:00 UTC',
  backupRetentionDays: 90,
  webhookEndpoints: [
    {
      id: 'billing-events',
      name: 'Billing provider webhooks',
      url: 'https://api.noxera.plus/webhooks/billing',
      enabled: true,
      lastDeliveryStatus: 'healthy',
      lastDeliveryAt: null,
    },
    {
      id: 'auth-events',
      name: 'Auth provider events',
      url: 'https://api.noxera.plus/webhooks/auth',
      enabled: true,
      lastDeliveryStatus: 'healthy',
      lastDeliveryAt: null,
    },
  ],
  providerHealth: {
    firebaseAuth: 'healthy',
    email: 'healthy',
    sms: 'degraded',
    payments: 'healthy',
  },
};

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformSettings() {
    const [profile, authPolicy, billingPolicy, auditRetention] = await Promise.all([
      this.getSetting(PLATFORM_PROFILE_KEY, DEFAULT_PLATFORM_PROFILE),
      this.getSetting(AUTH_ACCESS_POLICY_KEY, DEFAULT_AUTH_POLICY),
      this.getSetting(BILLING_POLICY_KEY, DEFAULT_BILLING_POLICY),
      this.getSetting(AUDIT_RETENTION_KEY, DEFAULT_AUDIT_RETENTION_POLICY),
    ]);

    return {
      platformProfile: profile,
      authAccessPolicy: authPolicy,
      billingPolicy,
      auditRetention,
    };
  }

  async getPublicPlatformProfile() {
    const profile = await this.getSetting(PLATFORM_PROFILE_KEY, DEFAULT_PLATFORM_PROFILE);
    const readString = (value: unknown, fallback: string) => {
      if (typeof value !== 'string') return fallback;
      const normalized = value.trim();
      return normalized || fallback;
    };

    return {
      orgName: readString(profile.orgName, DEFAULT_PLATFORM_PROFILE.orgName),
      defaultLocale: readString(profile.defaultLocale, DEFAULT_PLATFORM_PROFILE.defaultLocale),
      defaultCurrency: readString(profile.defaultCurrency, DEFAULT_PLATFORM_PROFILE.defaultCurrency),
      defaultCountry: readString(profile.defaultCountry, DEFAULT_PLATFORM_PROFILE.defaultCountry),
      defaultLanguage: readString(profile.defaultLanguage, DEFAULT_PLATFORM_PROFILE.defaultLanguage),
      logoUrl: readString(profile.logoUrl, DEFAULT_PLATFORM_PROFILE.logoUrl),
      faviconUrl: readString(profile.faviconUrl, DEFAULT_PLATFORM_PROFILE.faviconUrl),
      themeMode: readString(profile.themeMode, DEFAULT_PLATFORM_PROFILE.themeMode),
      brandPrimaryColor: readString(profile.brandPrimaryColor, DEFAULT_PLATFORM_PROFILE.brandPrimaryColor),
      brandAccentColor: readString(profile.brandAccentColor, DEFAULT_PLATFORM_PROFILE.brandAccentColor),
    };
  }

  async updatePlatformSettings(payload: {
    platformProfile?: JsonObject;
    authAccessPolicy?: JsonObject;
    billingPolicy?: JsonObject;
    auditRetention?: JsonObject;
  }, actorEmail?: string | null) {
    const writes: Promise<unknown>[] = [];

    if (payload.platformProfile) {
      writes.push(this.upsertSetting(PLATFORM_PROFILE_KEY, payload.platformProfile, actorEmail));
    }

    if (payload.authAccessPolicy) {
      writes.push(this.upsertSetting(AUTH_ACCESS_POLICY_KEY, payload.authAccessPolicy, actorEmail));
    }

    if (payload.billingPolicy) {
      writes.push(this.upsertSetting(BILLING_POLICY_KEY, payload.billingPolicy, actorEmail));
    }

    if (payload.auditRetention) {
      writes.push(this.upsertSetting(AUDIT_RETENTION_KEY, payload.auditRetention, actorEmail));
    }

    if (writes.length === 0) {
      throw new BadRequestException('At least one settings section is required.');
    }

    await Promise.all(writes);
    return this.getPlatformSettings();
  }

  async getNotificationPolicy() {
    return this.getSetting(NOTIFICATION_POLICY_KEY, DEFAULT_NOTIFICATION_POLICY);
  }

  async updateNotificationPolicy(payload: JsonObject, actorEmail?: string | null) {
    return this.upsertSetting(NOTIFICATION_POLICY_KEY, payload, actorEmail);
  }

  async getContentHubSettings() {
    return this.getSetting(CONTENT_HUB_KEY, DEFAULT_CONTENT_HUB);
  }

  async updateContentHubSettings(payload: JsonObject, actorEmail?: string | null) {
    return this.upsertSetting(CONTENT_HUB_KEY, payload, actorEmail);
  }

  async getSystemManagementSettings() {
    return this.getSetting(SYSTEM_MANAGEMENT_KEY, DEFAULT_SYSTEM_MANAGEMENT);
  }

  async updateSystemManagementSettings(payload: JsonObject, actorEmail?: string | null) {
    return this.upsertSetting(SYSTEM_MANAGEMENT_KEY, payload, actorEmail);
  }

  async listReleaseFlags(filters: ReleaseFlagFilters = {}) {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    const where = search
      ? {
          OR: [
            { key: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.featureFlag.count({ where }),
      this.prisma.featureFlag.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ key: 'asc' }],
      }),
    ]);

    return {
      items,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  async updateReleaseFlag(
    key: string,
    payload: { enabled?: boolean; rolloutStage?: string; description?: string | null; owner?: string | null; tenantCohort?: string[] },
    actorEmail?: string | null,
  ) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Release flag key is required.');
    }

    const existing = await this.prisma.featureFlag.findUnique({ where: { key: normalizedKey } });
    if (!existing) {
      throw new BadRequestException('Release flag not found.');
    }

    const nextTenantCohort = Array.isArray(payload.tenantCohort)
      ? Array.from(new Set(payload.tenantCohort.map((value) => value.trim()).filter(Boolean)))
      : existing.tenantCohort;

    const updated = await this.prisma.featureFlag.update({
      where: { key: normalizedKey },
      data: {
        ...(payload.enabled !== undefined ? { enabled: Boolean(payload.enabled) } : {}),
        ...(payload.rolloutStage !== undefined ? { rolloutStage: payload.rolloutStage.trim() || existing.rolloutStage } : {}),
        ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}),
        ...(payload.owner !== undefined ? { owner: payload.owner?.trim() || null } : {}),
        tenantCohort: nextTenantCohort,
      },
    });

    await this.prisma.outboxMessage
      .create({
        data: {
          tenantId: null,
          templateId: 'platform.release-flag.updated',
          recipient: actorEmail?.trim().toLowerCase() || 'platform@noxera.plus',
          payload: {
            key: updated.key,
            enabled: updated.enabled,
            rolloutStage: updated.rolloutStage,
            tenantCohort: updated.tenantCohort,
          } as Prisma.InputJsonValue,
          status: 'Sent',
        },
      })
      .catch(() => undefined);

    return updated;
  }

  private async getSetting(key: string, fallback: JsonObject) {
    const existing = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!existing) {
      await this.prisma.platformSetting.create({
        data: {
          key,
          value: fallback as Prisma.InputJsonValue,
        },
      });
      return fallback;
    }
    return (existing.value as JsonObject) ?? fallback;
  }

  private async upsertSetting(key: string, value: JsonObject, actorEmail?: string | null) {
    return this.prisma.platformSetting.upsert({
      where: { key },
      update: {
        value: value as Prisma.InputJsonValue,
        updatedByEmail: actorEmail?.trim().toLowerCase() || null,
      },
      create: {
        key,
        value: value as Prisma.InputJsonValue,
        updatedByEmail: actorEmail?.trim().toLowerCase() || null,
      },
    });
  }
}
