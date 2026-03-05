import { randomUUID } from 'crypto';
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
const SCHEDULED_EXPORT_JOBS_KEY = 'scheduled_export_jobs';
const COMPLIANCE_REQUESTS_KEY = 'compliance_requests';
const COMPLIANCE_AUTOMATION_POLICY_KEY = 'compliance_automation_policy';

type JsonObject = Record<string, unknown>;

type ReleaseFlagFilters = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
};

type ScheduledExportJobFilters = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  status?: unknown;
  dataset?: unknown;
};

type ComplianceRequestFilters = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  status?: unknown;
  type?: unknown;
  tenantId?: unknown;
};

type ComplianceTimelineFilters = {
  limit?: unknown;
  search?: unknown;
};

type ScheduledExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

type ScheduledExportJob = {
  id: string;
  name: string;
  dataset: string;
  format: ScheduledExportFormat;
  cadence: string;
  enabled: boolean;
  recipients: string[];
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastResult: 'queued' | 'running' | 'success' | 'failed';
  lastError?: string | null;
  lastRunDurationMs?: number | null;
  lastArtifactId?: string | null;
  lastArtifactGeneratedAt?: string | null;
  lastAttemptAt?: string | null;
  consecutiveFailures?: number;
  maxArtifacts?: number;
  maxRuns?: number;
};

type ScheduledExportArtifact = {
  id: string;
  jobId: string;
  fileName: string;
  format: ScheduledExportFormat;
  dataset: string;
  contentType: string;
  byteSize: number;
  checksum: string;
  trigger: 'manual' | 'scheduled';
  createdAt: string;
  storageBackend: 'local' | 's3';
  filePath?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
};

type ScheduledExportRun = {
  id: string;
  jobId: string;
  trigger: 'manual' | 'scheduled';
  status: 'success' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error: string | null;
  artifactId: string | null;
};

type ComplianceRequestType = 'DATA_EXPORT' | 'DATA_DELETION' | 'RETENTION_EXCEPTION' | 'ACCESS_REVIEW';
type ComplianceRequestStatus = 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Completed';

type ComplianceTimelineEvent = {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  note: string | null;
  status: ComplianceRequestStatus;
};

type ComplianceWorkflowState = {
  slaStartedAt: string;
  slaDueAt: string | null;
  completedAt: string | null;
  lastReminderAt: string | null;
  reminderMilestonesSentHours: number[];
  reminderCount: number;
  lastEscalatedAt: string | null;
  escalationMilestonesSentHours: number[];
  escalationCount: number;
};

type ComplianceRequest = {
  id: string;
  type: ComplianceRequestType;
  title: string;
  description: string | null;
  tenantId: string | null;
  tenantName: string | null;
  requestedByEmail: string;
  assigneeEmail: string | null;
  status: ComplianceRequestStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  history: ComplianceTimelineEvent[];
  workflow: ComplianceWorkflowState;
};

type ComplianceAutomationPolicy = {
  enabled: boolean;
  defaultSlaHours: number;
  reminderHoursBeforeDue: number[];
  escalationHoursAfterDue: number[];
  escalationRecipientEmails: string[];
};

type WebhookEndpointConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastDeliveryStatus: string;
  lastDeliveryAt: string | null;
};

type SystemManagementSettings = {
  maintenanceMode: boolean;
  statusPageUrl: string;
  backupWindow: string;
  backupRetentionDays: number;
  webhookEndpoints: WebhookEndpointConfig[];
  providerHealth: Record<string, string>;
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
  baseFontFamily: 'inter',
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

const DEFAULT_SCHEDULED_EXPORT_JOBS = {
  jobs: [] as ScheduledExportJob[],
  artifacts: [] as ScheduledExportArtifact[],
  runs: [] as ScheduledExportRun[],
};

const DEFAULT_COMPLIANCE_REQUESTS = {
  requests: [] as ComplianceRequest[],
};

const DEFAULT_COMPLIANCE_AUTOMATION_POLICY: ComplianceAutomationPolicy = {
  enabled: true,
  defaultSlaHours: 72,
  reminderHoursBeforeDue: [48, 24, 4],
  escalationHoursAfterDue: [0, 24, 72],
  escalationRecipientEmails: ['compliance@noxera.plus'],
};

const SUPPORTED_EXPORT_FORMATS: ScheduledExportFormat[] = ['csv', 'xlsx', 'pdf', 'json'];
const DEFAULT_JOB_MAX_ARTIFACTS = 25;
const DEFAULT_JOB_MAX_RUNS = 50;
const SUPPORTED_COMPLIANCE_REQUEST_TYPES: ComplianceRequestType[] = [
  'DATA_EXPORT',
  'DATA_DELETION',
  'RETENTION_EXCEPTION',
  'ACCESS_REVIEW',
];
const SUPPORTED_COMPLIANCE_STATUSES: ComplianceRequestStatus[] = [
  'Pending',
  'In Review',
  'Approved',
  'Rejected',
  'Completed',
];

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
      baseFontFamily: readString(profile.baseFontFamily, DEFAULT_PLATFORM_PROFILE.baseFontFamily),
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

  async runWebhookHealthCheck(webhookId: string, actorEmail?: string | null) {
    const normalizedId = webhookId.trim();
    if (!normalizedId) {
      throw new BadRequestException('Webhook id is required.');
    }

    const settings = (await this.getSystemManagementSettings()) as unknown as SystemManagementSettings;
    const endpoints = Array.isArray(settings.webhookEndpoints) ? [...settings.webhookEndpoints] : [];
    const endpointIndex = endpoints.findIndex((endpoint) => endpoint.id === normalizedId);

    if (endpointIndex === -1) {
      throw new BadRequestException('Webhook endpoint not found.');
    }

    const endpoint = endpoints[endpointIndex];
    const startedAt = Date.now();
    let status: string = 'healthy';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(endpoint.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!response.ok) {
        status = response.status >= 500 ? 'degraded' : 'unhealthy';
      }
    } catch {
      status = 'down';
    } finally {
      clearTimeout(timeout);
    }

    const checkedAt = new Date().toISOString();
    const latencyMs = Date.now() - startedAt;

    const nextEndpoint: WebhookEndpointConfig = {
      ...endpoint,
      lastDeliveryStatus: status,
      lastDeliveryAt: checkedAt,
    };

    endpoints[endpointIndex] = nextEndpoint;
    const nextProviderHealth = {
      ...(settings.providerHealth ?? {}),
      [`webhook:${normalizedId}`]: status,
    };

    const nextSettings: SystemManagementSettings = {
      ...settings,
      webhookEndpoints: endpoints,
      providerHealth: nextProviderHealth,
    };

    await this.upsertSetting(SYSTEM_MANAGEMENT_KEY, nextSettings as unknown as JsonObject, actorEmail);

    await this.prisma.outboxMessage.create({
      data: {
        tenantId: null,
        templateId: 'platform.webhook.health-check',
        recipient: actorEmail?.trim().toLowerCase() || 'platform@noxera.plus',
        payload: {
          webhookId: normalizedId,
          webhookName: endpoint.name,
          status,
          latencyMs,
          checkedAt,
        } as Prisma.InputJsonValue,
        status: 'Sent',
      },
    }).catch(() => undefined);

    return {
      webhook: nextEndpoint,
      status,
      latencyMs,
      checkedAt,
    };
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

  async listScheduledExportJobs(filters: ScheduledExportJobFilters = {}) {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';
    const status = typeof filters.status === 'string' ? filters.status.trim().toLowerCase() : '';
    const dataset = typeof filters.dataset === 'string' ? filters.dataset.trim().toLowerCase() : '';

    const state = await this.getScheduledExportState();
    let items = [...state.jobs];

    if (search) {
      items = items.filter((job) =>
        [job.name, job.dataset, job.cadence, job.recipients.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(search),
      );
    }

    if (status === 'enabled') {
      items = items.filter((job) => job.enabled);
    } else if (status === 'disabled') {
      items = items.filter((job) => !job.enabled);
    } else if (['queued', 'running', 'success', 'failed'].includes(status)) {
      items = items.filter((job) => job.lastResult.toLowerCase() === status);
    }

    if (dataset) {
      items = items.filter((job) => job.dataset.toLowerCase().includes(dataset));
    }

    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const total = items.length;
    const paged = items.slice(pagination.skip, pagination.skip + pagination.take);
    return {
      items: paged,
      page: pagination.page,
      limit: pagination.limit,
      total,
      summary: {
        enabled: items.filter((job) => job.enabled).length,
        disabled: items.filter((job) => !job.enabled).length,
      },
    };
  }

  async createScheduledExportJob(
    payload: {
      name: string;
      dataset: string;
      format: string;
      cadence: string;
      recipients?: string[];
      nextRunAt?: string;
      enabled?: boolean;
      maxArtifacts?: number;
      maxRuns?: number;
    },
    actorEmail?: string | null,
  ) {
    const name = payload.name?.trim();
    const dataset = payload.dataset?.trim();
    const cadence = payload.cadence?.trim();

    if (!name) throw new BadRequestException('Export job name is required.');
    if (!dataset) throw new BadRequestException('Dataset is required.');
    if (!cadence) throw new BadRequestException('Cadence is required.');

    const now = new Date().toISOString();
    const format = this.normalizeScheduledExportFormat(payload.format);
    const recipients = this.normalizeEmailList(payload.recipients);
    const nextRunAt = this.normalizeIsoDate(payload.nextRunAt) ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createdByEmail = actorEmail?.trim().toLowerCase() || null;
    const maxArtifacts = this.normalizePositiveInteger(payload.maxArtifacts, DEFAULT_JOB_MAX_ARTIFACTS, 200, 1);
    const maxRuns = this.normalizePositiveInteger(payload.maxRuns, DEFAULT_JOB_MAX_RUNS, 500, 1);

    const nextJob: ScheduledExportJob = {
      id: randomUUID(),
      name,
      dataset,
      format,
      cadence,
      enabled: payload.enabled ?? true,
      recipients: recipients.length > 0 ? recipients : createdByEmail ? [createdByEmail] : [],
      createdByEmail,
      createdAt: now,
      updatedAt: now,
      nextRunAt,
      lastRunAt: null,
      lastResult: 'queued',
      lastAttemptAt: null,
      consecutiveFailures: 0,
      maxArtifacts,
      maxRuns,
    };

    const state = await this.getScheduledExportState();
    await this.saveScheduledExportState({ jobs: [nextJob, ...state.jobs] }, actorEmail);

    await this.prisma.outboxMessage.create({
      data: {
        tenantId: null,
        templateId: 'platform.export-job.created',
        recipient: createdByEmail ?? 'platform@noxera.plus',
        payload: {
          id: nextJob.id,
          name: nextJob.name,
          dataset: nextJob.dataset,
          cadence: nextJob.cadence,
        } as Prisma.InputJsonValue,
        status: 'Sent',
      },
    }).catch(() => undefined);

    return nextJob;
  }

  async updateScheduledExportJob(
    id: string,
    payload: {
      name?: string;
      dataset?: string;
      format?: string;
      cadence?: string;
      recipients?: string[];
      nextRunAt?: string | null;
      enabled?: boolean;
      runNow?: boolean;
      lastResult?: 'queued' | 'running' | 'success' | 'failed';
      maxArtifacts?: number;
      maxRuns?: number;
    },
    actorEmail?: string | null,
  ) {
    const normalizedId = id.trim();
    if (!normalizedId) throw new BadRequestException('Export job id is required.');

    const state = await this.getScheduledExportState();
    const index = state.jobs.findIndex((job) => job.id === normalizedId);
    if (index === -1) {
      throw new BadRequestException('Scheduled export job not found.');
    }

    const current = state.jobs[index];
    const now = new Date().toISOString();
    const normalizedRecipients = payload.recipients ? this.normalizeEmailList(payload.recipients) : current.recipients;
    const nextRunAt = payload.nextRunAt === null ? null : this.normalizeIsoDate(payload.nextRunAt) ?? current.nextRunAt;
    const runNow = payload.runNow === true;
    const nextLastRunAt = current.lastRunAt;

    const next: ScheduledExportJob = {
      ...current,
      ...(payload.name !== undefined ? { name: payload.name.trim() || current.name } : {}),
      ...(payload.dataset !== undefined ? { dataset: payload.dataset.trim() || current.dataset } : {}),
      ...(payload.format !== undefined ? { format: this.normalizeScheduledExportFormat(payload.format) } : {}),
      ...(payload.cadence !== undefined ? { cadence: payload.cadence.trim() || current.cadence } : {}),
      ...(payload.enabled !== undefined ? { enabled: Boolean(payload.enabled) } : {}),
      ...(payload.maxArtifacts !== undefined
        ? { maxArtifacts: this.normalizePositiveInteger(payload.maxArtifacts, current.maxArtifacts ?? DEFAULT_JOB_MAX_ARTIFACTS, 200, 1) }
        : {}),
      ...(payload.maxRuns !== undefined
        ? { maxRuns: this.normalizePositiveInteger(payload.maxRuns, current.maxRuns ?? DEFAULT_JOB_MAX_RUNS, 500, 1) }
        : {}),
      recipients: normalizedRecipients,
      nextRunAt: runNow ? now : (nextRunAt ?? current.nextRunAt),
      lastRunAt: nextLastRunAt,
      lastResult: payload.lastResult ?? (runNow ? 'queued' : current.lastResult),
      updatedAt: now,
    };

    const jobs = [...state.jobs];
    jobs[index] = next;
    await this.saveScheduledExportState({ jobs }, actorEmail);

    await this.prisma.outboxMessage.create({
      data: {
        tenantId: null,
        templateId: 'platform.export-job.updated',
        recipient: actorEmail?.trim().toLowerCase() || 'platform@noxera.plus',
        payload: {
          id: next.id,
          name: next.name,
          enabled: next.enabled,
          runNow,
        } as Prisma.InputJsonValue,
        status: 'Sent',
      },
    }).catch(() => undefined);

    return next;
  }

  async listComplianceRequests(filters: ComplianceRequestFilters = {}) {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';
    const status = typeof filters.status === 'string' ? filters.status.trim().toLowerCase() : '';
    const type = typeof filters.type === 'string' ? filters.type.trim().toUpperCase() : '';
    const tenantId = typeof filters.tenantId === 'string' ? filters.tenantId.trim() : '';

    const state = await this.getComplianceRequestsState();
    let items = [...state.requests];

    if (search) {
      items = items.filter((request) =>
        [
          request.id,
          request.title,
          request.description ?? '',
          request.requestedByEmail,
          request.assigneeEmail ?? '',
          request.tenantName ?? '',
          request.type,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search),
      );
    }

    if (status) {
      items = items.filter((request) => request.status.toLowerCase() === status);
    }

    if (type) {
      items = items.filter((request) => request.type === type);
    }

    if (tenantId) {
      items = items.filter((request) => request.tenantId === tenantId);
    }

    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const total = items.length;
    const paged = items.slice(pagination.skip, pagination.skip + pagination.take);

    return {
      items: paged,
      page: pagination.page,
      limit: pagination.limit,
      total,
      summary: {
        pending: items.filter((request) => request.status === 'Pending').length,
        inReview: items.filter((request) => request.status === 'In Review').length,
        completed: items.filter((request) => request.status === 'Completed').length,
      },
    };
  }

  async createComplianceRequest(
    payload: {
      type: string;
      title: string;
      description?: string | null;
      tenantId?: string | null;
      tenantName?: string | null;
      requestedByEmail?: string | null;
      assigneeEmail?: string | null;
      dueAt?: string | null;
      notes?: string | null;
      status?: string;
    },
    actorEmail?: string | null,
  ) {
    const type = this.normalizeComplianceRequestType(payload.type);
    const title = payload.title?.trim();
    if (!title) {
      throw new BadRequestException('Request title is required.');
    }

    const now = new Date().toISOString();
    const requestedByEmail = payload.requestedByEmail?.trim().toLowerCase()
      || actorEmail?.trim().toLowerCase()
      || 'platform@noxera.plus';
    const status = payload.status ? this.normalizeComplianceStatus(payload.status) : 'Pending';
    const policy = await this.getComplianceAutomationPolicy();
    const dueAt = this.normalizeIsoDate(payload.dueAt)
      ?? new Date(Date.now() + (policy.defaultSlaHours * 60 * 60 * 1000)).toISOString();

    const history: ComplianceTimelineEvent[] = [
      {
        id: randomUUID(),
        at: now,
        actorEmail: actorEmail?.trim().toLowerCase() || requestedByEmail,
        action: 'REQUEST_CREATED',
        note: payload.notes?.trim() || null,
        status,
      },
    ];

    const request: ComplianceRequest = {
      id: randomUUID(),
      type,
      title,
      description: payload.description?.trim() || null,
      tenantId: payload.tenantId?.trim() || null,
      tenantName: payload.tenantName?.trim() || null,
      requestedByEmail,
      assigneeEmail: payload.assigneeEmail?.trim().toLowerCase() || null,
      status,
      dueAt,
      createdAt: now,
      updatedAt: now,
      resolvedAt: status === 'Completed' || status === 'Rejected' ? now : null,
      notes: payload.notes?.trim() || null,
      history,
      workflow: this.normalizeComplianceWorkflow(undefined, now, dueAt),
    };

    const state = await this.getComplianceRequestsState();
    await this.saveComplianceRequestsState({ requests: [request, ...state.requests] }, actorEmail);

    await this.prisma.outboxMessage.create({
      data: {
        tenantId: request.tenantId,
        templateId: 'platform.compliance-request.created',
        recipient: request.assigneeEmail || request.requestedByEmail,
        payload: {
          id: request.id,
          type: request.type,
          status: request.status,
          tenantId: request.tenantId,
        } as Prisma.InputJsonValue,
        status: 'Sent',
      },
    }).catch(() => undefined);

    return request;
  }

  async updateComplianceRequest(
    id: string,
    payload: {
      status?: string;
      assigneeEmail?: string | null;
      dueAt?: string | null;
      notes?: string | null;
      title?: string;
      description?: string | null;
    },
    actorEmail?: string | null,
  ) {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new BadRequestException('Compliance request id is required.');
    }

    const state = await this.getComplianceRequestsState();
    const index = state.requests.findIndex((request) => request.id === normalizedId);
    if (index === -1) {
      throw new BadRequestException('Compliance request not found.');
    }

    const current = state.requests[index];
    const now = new Date().toISOString();
    const nextStatus = payload.status ? this.normalizeComplianceStatus(payload.status) : current.status;
    const resolvedAt = nextStatus === 'Completed' || nextStatus === 'Rejected' ? now : current.resolvedAt;
    const note = payload.notes?.trim() || null;
    const dueAt = payload.dueAt !== undefined ? this.normalizeIsoDate(payload.dueAt) : current.dueAt;
    const workflow = this.normalizeComplianceWorkflow(current.workflow, current.createdAt, dueAt);

    const history: ComplianceTimelineEvent = {
      id: randomUUID(),
      at: now,
      actorEmail: actorEmail?.trim().toLowerCase() || 'platform@noxera.plus',
      action: payload.status ? 'STATUS_UPDATED' : 'REQUEST_UPDATED',
      note,
      status: nextStatus,
    };

    const next: ComplianceRequest = {
      ...current,
      ...(payload.title !== undefined ? { title: payload.title.trim() || current.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}),
      ...(payload.assigneeEmail !== undefined ? { assigneeEmail: payload.assigneeEmail?.trim().toLowerCase() || null } : {}),
      ...(payload.dueAt !== undefined ? { dueAt } : {}),
      ...(payload.notes !== undefined ? { notes: note } : {}),
      status: nextStatus,
      resolvedAt,
      updatedAt: now,
      history: [...current.history, history],
      workflow: {
        ...workflow,
        slaDueAt: dueAt,
        completedAt:
          nextStatus === 'Completed' || nextStatus === 'Rejected'
            ? now
            : current.status === 'Completed' || current.status === 'Rejected'
              ? null
              : workflow.completedAt,
      },
    };

    const requests = [...state.requests];
    requests[index] = next;
    await this.saveComplianceRequestsState({ requests }, actorEmail);

    await this.prisma.outboxMessage.create({
      data: {
        tenantId: next.tenantId,
        templateId: 'platform.compliance-request.updated',
        recipient: next.assigneeEmail || next.requestedByEmail,
        payload: {
          id: next.id,
          status: next.status,
          assigneeEmail: next.assigneeEmail,
        } as Prisma.InputJsonValue,
        status: 'Sent',
      },
    }).catch(() => undefined);

    return next;
  }

  async getComplianceTimeline(filters: ComplianceTimelineFilters = {}) {
    const requestedLimit = typeof filters.limit === 'string' ? Number.parseInt(filters.limit, 10) : Number(filters.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
    const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';

    const state = await this.getComplianceRequestsState();
    const events = state.requests.flatMap((request) =>
      request.history.map((entry) => ({
        ...entry,
        requestId: request.id,
        requestTitle: request.title,
        requestType: request.type,
        tenantId: request.tenantId,
        tenantName: request.tenantName,
      })),
    );

    const filtered = search
      ? events.filter((entry) =>
          [
            entry.requestId,
            entry.requestTitle,
            entry.requestType,
            entry.actorEmail,
            entry.action,
            entry.note ?? '',
            entry.tenantName ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(search),
        )
      : events;

    filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
    };
  }

  async getComplianceAutomationPolicy() {
    const value = await this.getSetting(
      COMPLIANCE_AUTOMATION_POLICY_KEY,
      DEFAULT_COMPLIANCE_AUTOMATION_POLICY as unknown as JsonObject,
    );
    return this.normalizeComplianceAutomationPolicy(value as unknown as ComplianceAutomationPolicy);
  }

  async updateComplianceAutomationPolicy(
    payload: {
      enabled?: boolean;
      defaultSlaHours?: number;
      reminderHoursBeforeDue?: number[];
      escalationHoursAfterDue?: number[];
      escalationRecipientEmails?: string[];
    },
    actorEmail?: string | null,
  ) {
    const current = await this.getComplianceAutomationPolicy();
    const next: ComplianceAutomationPolicy = {
      enabled: payload.enabled ?? current.enabled,
      defaultSlaHours: this.normalizePositiveInteger(payload.defaultSlaHours, current.defaultSlaHours, 24 * 30, 1),
      reminderHoursBeforeDue:
        payload.reminderHoursBeforeDue !== undefined
          ? this.normalizeNumericMilestones(payload.reminderHoursBeforeDue, current.reminderHoursBeforeDue)
          : current.reminderHoursBeforeDue,
      escalationHoursAfterDue:
        payload.escalationHoursAfterDue !== undefined
          ? this.normalizeNumericMilestones(payload.escalationHoursAfterDue, current.escalationHoursAfterDue)
          : current.escalationHoursAfterDue,
      escalationRecipientEmails:
        payload.escalationRecipientEmails !== undefined
          ? this.normalizeEmailList(payload.escalationRecipientEmails)
          : current.escalationRecipientEmails,
    };

    await this.upsertSetting(
      COMPLIANCE_AUTOMATION_POLICY_KEY,
      next as unknown as JsonObject,
      actorEmail,
    );

    return next;
  }

  async runComplianceAutomationCycle(actorEmail?: string | null) {
    const policy = await this.getComplianceAutomationPolicy();
    if (!policy.enabled) {
      return { processed: 0, remindersSent: 0, escalationsSent: 0, completedAudits: 0 };
    }

    const state = await this.getComplianceRequestsState();
    if (state.requests.length === 0) {
      return { processed: 0, remindersSent: 0, escalationsSent: 0, completedAudits: 0 };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const normalizedActor = actorEmail?.trim().toLowerCase() || 'platform-automation@noxera.plus';
    let changed = false;
    let remindersSent = 0;
    let escalationsSent = 0;
    let completedAudits = 0;

    const requests = [...state.requests];

    for (let index = 0; index < requests.length; index += 1) {
      const current = requests[index];
      let next = { ...current };
      let workflow = this.normalizeComplianceWorkflow(current.workflow, current.createdAt, current.dueAt);

      if (!next.dueAt) {
        const fallbackDueAt = new Date(new Date(next.createdAt).getTime() + (policy.defaultSlaHours * 60 * 60 * 1000)).toISOString();
        next = { ...next, dueAt: fallbackDueAt };
        workflow = { ...workflow, slaDueAt: fallbackDueAt };
        changed = true;
      }

      const isTerminal = next.status === 'Completed' || next.status === 'Rejected';
      if (isTerminal) {
        if (!workflow.completedAt) {
          const completedAt = next.resolvedAt || nowIso;
          workflow = { ...workflow, completedAt };
          next = {
            ...next,
            workflow,
            history: [
              ...next.history,
              {
                id: randomUUID(),
                at: completedAt,
                actorEmail: normalizedActor,
                action: 'WORKFLOW_COMPLETION_AUDIT',
                note: 'Automated completion audit trail captured.',
                status: next.status,
              },
            ],
          };
          completedAudits += 1;
          changed = true;
        }
        requests[index] = next;
        continue;
      }

      const dueAtIso = next.dueAt || workflow.slaDueAt;
      if (!dueAtIso) {
        requests[index] = { ...next, workflow };
        continue;
      }

      const dueAt = new Date(dueAtIso);
      if (Number.isNaN(dueAt.getTime())) {
        requests[index] = { ...next, workflow };
        continue;
      }

      const hoursUntilDue = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
      const hoursOverdue = (now.getTime() - dueAt.getTime()) / (60 * 60 * 1000);

      for (const reminderHour of policy.reminderHoursBeforeDue) {
        if (hoursUntilDue <= reminderHour && hoursUntilDue > 0 && !workflow.reminderMilestonesSentHours.includes(reminderHour)) {
          const recipient = next.assigneeEmail || next.requestedByEmail;
          await this.prisma.outboxMessage.create({
            data: {
              tenantId: next.tenantId,
              templateId: 'platform.compliance-request.reminder',
              recipient,
              payload: {
                requestId: next.id,
                title: next.title,
                type: next.type,
                dueAt: dueAtIso,
                reminderHour,
              } as Prisma.InputJsonValue,
              status: 'Pending',
            },
          }).catch(() => undefined);

          const reminderAt = nowIso;
          workflow = {
            ...workflow,
            lastReminderAt: reminderAt,
            reminderMilestonesSentHours: [...workflow.reminderMilestonesSentHours, reminderHour].sort((a, b) => b - a),
            reminderCount: workflow.reminderCount + 1,
          };
          next = {
            ...next,
            history: [
              ...next.history,
              {
                id: randomUUID(),
                at: reminderAt,
                actorEmail: normalizedActor,
                action: 'SLA_REMINDER_SENT',
                note: `Reminder sent ${reminderHour}h before SLA due time.`,
                status: next.status,
              },
            ],
          };
          remindersSent += 1;
          changed = true;
        }
      }

      if (hoursOverdue >= 0) {
        for (const escalationHour of policy.escalationHoursAfterDue) {
          if (hoursOverdue >= escalationHour && !workflow.escalationMilestonesSentHours.includes(escalationHour)) {
            const recipients = new Set<string>([
              ...(policy.escalationRecipientEmails ?? []),
              next.assigneeEmail || '',
              next.requestedByEmail || '',
            ]);

            for (const recipient of recipients) {
              const normalizedRecipient = recipient.trim().toLowerCase();
              if (!normalizedRecipient) continue;
              await this.prisma.outboxMessage.create({
                data: {
                  tenantId: next.tenantId,
                  templateId: 'platform.compliance-request.escalated',
                  recipient: normalizedRecipient,
                  payload: {
                    requestId: next.id,
                    title: next.title,
                    type: next.type,
                    dueAt: dueAtIso,
                    escalationHour,
                    tenantId: next.tenantId,
                    tenantName: next.tenantName,
                  } as Prisma.InputJsonValue,
                  status: 'Pending',
                },
              }).catch(() => undefined);
            }

            const escalatedAt = nowIso;
            workflow = {
              ...workflow,
              lastEscalatedAt: escalatedAt,
              escalationMilestonesSentHours: [...workflow.escalationMilestonesSentHours, escalationHour].sort((a, b) => a - b),
              escalationCount: workflow.escalationCount + 1,
            };
            next = {
              ...next,
              history: [
                ...next.history,
                {
                  id: randomUUID(),
                  at: escalatedAt,
                  actorEmail: normalizedActor,
                  action: 'SLA_ESCALATION_TRIGGERED',
                  note: `Escalated at ${escalationHour}h overdue.`,
                  status: next.status,
                },
              ],
            };
            escalationsSent += 1;
            changed = true;
          }
        }
      }

      requests[index] = { ...next, workflow };
    }

    if (changed) {
      await this.saveComplianceRequestsState({ requests }, normalizedActor);
    }

    return {
      processed: requests.length,
      remindersSent,
      escalationsSent,
      completedAudits,
    };
  }

  private normalizeComplianceAutomationPolicy(raw: ComplianceAutomationPolicy): ComplianceAutomationPolicy {
    const source = (raw && typeof raw === 'object') ? raw : DEFAULT_COMPLIANCE_AUTOMATION_POLICY;
    return {
      enabled: source.enabled !== false,
      defaultSlaHours: this.normalizePositiveInteger(source.defaultSlaHours, DEFAULT_COMPLIANCE_AUTOMATION_POLICY.defaultSlaHours, 24 * 30, 1),
      reminderHoursBeforeDue: this.normalizeNumericMilestones(
        source.reminderHoursBeforeDue,
        DEFAULT_COMPLIANCE_AUTOMATION_POLICY.reminderHoursBeforeDue,
      ),
      escalationHoursAfterDue: this.normalizeNumericMilestones(
        source.escalationHoursAfterDue,
        DEFAULT_COMPLIANCE_AUTOMATION_POLICY.escalationHoursAfterDue,
      ),
      escalationRecipientEmails: this.normalizeEmailList(source.escalationRecipientEmails),
    };
  }

  private normalizeNumericMilestones(value: unknown, fallback: number[]) {
    if (!Array.isArray(value)) return [...fallback];
    const normalized = Array.from(
      new Set(
        value
          .map((entry) =>
            typeof entry === 'number'
              ? Math.floor(entry)
              : typeof entry === 'string'
                ? Number.parseInt(entry, 10)
                : Number.NaN,
          )
          .filter((entry) => Number.isFinite(entry) && entry >= 0),
      ),
    ).sort((a, b) => b - a);

    return normalized.length > 0 ? normalized : [...fallback];
  }

  private normalizeComplianceWorkflow(
    raw: ComplianceWorkflowState | undefined,
    createdAt: string,
    dueAt: string | null,
  ): ComplianceWorkflowState {
    const source = (raw && typeof raw === 'object') ? raw : undefined;
    return {
      slaStartedAt: this.normalizeIsoDate(source?.slaStartedAt) ?? this.normalizeIsoDate(createdAt) ?? new Date().toISOString(),
      slaDueAt: this.normalizeIsoDate(source?.slaDueAt) ?? this.normalizeIsoDate(dueAt),
      completedAt: this.normalizeIsoDate(source?.completedAt),
      lastReminderAt: this.normalizeIsoDate(source?.lastReminderAt),
      reminderMilestonesSentHours: this.normalizeNumericMilestones(source?.reminderMilestonesSentHours, []),
      reminderCount: this.normalizePositiveInteger(source?.reminderCount, 0, 10_000, 0),
      lastEscalatedAt: this.normalizeIsoDate(source?.lastEscalatedAt),
      escalationMilestonesSentHours: this.normalizeNumericMilestones(source?.escalationMilestonesSentHours, []),
      escalationCount: this.normalizePositiveInteger(source?.escalationCount, 0, 10_000, 0),
    };
  }

  private normalizeComplianceRequest(raw: ComplianceRequest): ComplianceRequest {
    const dueAt = this.normalizeIsoDate(raw.dueAt);
    return {
      ...raw,
      dueAt,
      createdAt: this.normalizeIsoDate(raw.createdAt) ?? new Date().toISOString(),
      updatedAt: this.normalizeIsoDate(raw.updatedAt) ?? new Date().toISOString(),
      resolvedAt: this.normalizeIsoDate(raw.resolvedAt),
      workflow: this.normalizeComplianceWorkflow(raw.workflow, raw.createdAt, dueAt),
      history: Array.isArray(raw.history)
        ? raw.history
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
              id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : randomUUID(),
              at: this.normalizeIsoDate(entry.at) ?? new Date().toISOString(),
              actorEmail: typeof entry.actorEmail === 'string' && entry.actorEmail.trim()
                ? entry.actorEmail
                : 'platform@noxera.plus',
              action: typeof entry.action === 'string' && entry.action.trim() ? entry.action : 'REQUEST_UPDATED',
              note: typeof entry.note === 'string' ? entry.note : null,
              status: this.coerceComplianceStatus(entry.status),
            }))
        : [],
    };
  }

  private normalizeScheduledExportFormat(value: string | undefined): ScheduledExportFormat {
    const normalized = value?.trim().toLowerCase() || '';
    if (!SUPPORTED_EXPORT_FORMATS.includes(normalized as ScheduledExportFormat)) {
      throw new BadRequestException(`Unsupported export format. Allowed: ${SUPPORTED_EXPORT_FORMATS.join(', ')}`);
    }
    return normalized as ScheduledExportFormat;
  }

  private normalizeScheduledExportResult(value: unknown): ScheduledExportJob['lastResult'] {
    if (typeof value !== 'string') return 'queued';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'running' || normalized === 'success' || normalized === 'failed' || normalized === 'queued') {
      return normalized;
    }
    return 'queued';
  }

  private normalizeScheduledExportJob(raw: ScheduledExportJob): ScheduledExportJob {
    return {
      ...raw,
      lastResult: this.normalizeScheduledExportResult(raw.lastResult),
      lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
      lastRunDurationMs: typeof raw.lastRunDurationMs === 'number' ? raw.lastRunDurationMs : null,
      lastArtifactId: typeof raw.lastArtifactId === 'string' ? raw.lastArtifactId : null,
      lastArtifactGeneratedAt: typeof raw.lastArtifactGeneratedAt === 'string' ? raw.lastArtifactGeneratedAt : null,
      lastAttemptAt: typeof raw.lastAttemptAt === 'string' ? raw.lastAttemptAt : null,
      consecutiveFailures: this.normalizePositiveInteger(raw.consecutiveFailures, 0, 1_000, 0),
      maxArtifacts: this.normalizePositiveInteger(raw.maxArtifacts, DEFAULT_JOB_MAX_ARTIFACTS, 200, 1),
      maxRuns: this.normalizePositiveInteger(raw.maxRuns, DEFAULT_JOB_MAX_RUNS, 500, 1),
    };
  }

  private normalizePositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER, min = 1) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < min) {
      return fallback;
    }

    return Math.min(parsed, max);
  }

  private normalizeComplianceRequestType(value: string | undefined): ComplianceRequestType {
    const normalized = value?.trim().toUpperCase() || '';
    if (!SUPPORTED_COMPLIANCE_REQUEST_TYPES.includes(normalized as ComplianceRequestType)) {
      throw new BadRequestException(`Unsupported request type. Allowed: ${SUPPORTED_COMPLIANCE_REQUEST_TYPES.join(', ')}`);
    }
    return normalized as ComplianceRequestType;
  }

  private normalizeComplianceStatus(value: string | undefined): ComplianceRequestStatus {
    const normalized = value?.trim() || '';
    if (!SUPPORTED_COMPLIANCE_STATUSES.includes(normalized as ComplianceRequestStatus)) {
      throw new BadRequestException(`Unsupported request status. Allowed: ${SUPPORTED_COMPLIANCE_STATUSES.join(', ')}`);
    }
    return normalized as ComplianceRequestStatus;
  }

  private coerceComplianceStatus(value: unknown, fallback: ComplianceRequestStatus = 'Pending'): ComplianceRequestStatus {
    if (typeof value !== 'string') {
      return fallback;
    }
    const normalized = value.trim();
    if (SUPPORTED_COMPLIANCE_STATUSES.includes(normalized as ComplianceRequestStatus)) {
      return normalized as ComplianceRequestStatus;
    }
    return fallback;
  }

  private normalizeIsoDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private normalizeEmailList(value: string[] | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
      value
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ));
  }

  private async getScheduledExportState() {
    const state = await this.getSetting(
      SCHEDULED_EXPORT_JOBS_KEY,
      DEFAULT_SCHEDULED_EXPORT_JOBS as unknown as JsonObject,
    );
    const jobs = Array.isArray((state as { jobs?: unknown }).jobs)
      ? ((state as { jobs: ScheduledExportJob[] }).jobs).map((job) => this.normalizeScheduledExportJob(job))
      : [];
    const artifacts = Array.isArray((state as { artifacts?: unknown }).artifacts)
      ? ((state as { artifacts: ScheduledExportArtifact[] }).artifacts)
      : [];
    const runs = Array.isArray((state as { runs?: unknown }).runs)
      ? ((state as { runs: ScheduledExportRun[] }).runs)
      : [];
    return { jobs, artifacts, runs };
  }

  private async saveScheduledExportState(
    state: { jobs: ScheduledExportJob[]; artifacts?: ScheduledExportArtifact[]; runs?: ScheduledExportRun[] },
    actorEmail?: string | null,
  ) {
    const current = await this.getSetting(
      SCHEDULED_EXPORT_JOBS_KEY,
      DEFAULT_SCHEDULED_EXPORT_JOBS as unknown as JsonObject,
    );
    const persistedArtifacts = Array.isArray((current as { artifacts?: unknown }).artifacts)
      ? ((current as { artifacts: ScheduledExportArtifact[] }).artifacts)
      : [];
    const persistedRuns = Array.isArray((current as { runs?: unknown }).runs)
      ? ((current as { runs: ScheduledExportRun[] }).runs)
      : [];

    await this.upsertSetting(
      SCHEDULED_EXPORT_JOBS_KEY,
      {
        jobs: state.jobs,
        artifacts: state.artifacts ?? persistedArtifacts,
        runs: state.runs ?? persistedRuns,
      } as unknown as JsonObject,
      actorEmail,
    );
  }

  private async getComplianceRequestsState() {
    const state = await this.getSetting(
      COMPLIANCE_REQUESTS_KEY,
      DEFAULT_COMPLIANCE_REQUESTS as unknown as JsonObject,
    );
    const requests = Array.isArray((state as { requests?: unknown }).requests)
      ? ((state as { requests: ComplianceRequest[] }).requests).map((request) => this.normalizeComplianceRequest(request))
      : [];
    return { requests };
  }

  private async saveComplianceRequestsState(state: { requests: ComplianceRequest[] }, actorEmail?: string | null) {
    await this.upsertSetting(COMPLIANCE_REQUESTS_KEY, state as unknown as JsonObject, actorEmail);
  }

  private async getSetting(key: string, fallback: JsonObject) {
    const existing = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!existing) {
      await this.prisma.platformSetting.create({
        data: {
          key,
          value: fallback as Prisma.InputJsonValue,
        },
      }).catch((error: unknown) => {
        // Another request may create the same key concurrently.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return;
        }
        throw error;
      });

      const created = await this.prisma.platformSetting.findUnique({ where: { key } });
      return (created?.value as JsonObject | undefined) ?? fallback;
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
