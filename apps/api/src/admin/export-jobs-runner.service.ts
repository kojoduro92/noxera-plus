import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@noxera-plus/shared';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

const SCHEDULED_EXPORT_JOBS_KEY = 'scheduled_export_jobs';
const SUPPORTED_EXPORT_FORMATS = ['csv', 'xlsx', 'pdf', 'json'] as const;
const SCAN_LOCK_KEY = 'platform-export-worker-scan';

type ScheduledExportFormat = (typeof SUPPORTED_EXPORT_FORMATS)[number];
type ExportStorageBackend = 'local' | 's3';
type ExportJobStatus = 'queued' | 'running' | 'success' | 'failed';
type ExportRunTrigger = 'manual' | 'scheduled';

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
  lastResult: ExportJobStatus;
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
  trigger: ExportRunTrigger;
  createdAt: string;
  storageBackend: ExportStorageBackend;
  filePath?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
};

type ScheduledExportRun = {
  id: string;
  jobId: string;
  trigger: ExportRunTrigger;
  status: 'success' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error: string | null;
  artifactId: string | null;
};

type ScheduledExportState = {
  jobs: ScheduledExportJob[];
  artifacts: ScheduledExportArtifact[];
  runs: ScheduledExportRun[];
};

type ExportRow = Record<string, string | number | boolean | null>;

type ExportDataset = {
  title: string;
  rows: ExportRow[];
};

type ExportArtifactWriteResult = {
  artifact: ScheduledExportArtifact;
};

type ExportArtifactDownload = {
  artifact: ScheduledExportArtifact;
  localFilePath: string | null;
  redirectUrl: string | null;
};

type LockParts = {
  keyA: number;
  keyB: number;
};

@Injectable()
export class ExportJobsRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportJobsRunnerService.name);
  private timer: NodeJS.Timeout | null = null;
  private workerRunning = false;
  private readonly inFlightJobIds = new Set<string>();

  private readonly jobsEnabled = this.resolveBooleanEnv('EXPORT_WORKER_ENABLED', process.env.NODE_ENV !== 'test');
  private readonly intervalMs = this.resolveNumberEnv('EXPORT_WORKER_INTERVAL_MS', 60_000);
  private readonly batchSize = this.resolveNumberEnv('EXPORT_WORKER_BATCH_SIZE', 5);
  private readonly maxRowsPerExport = this.resolveNumberEnv('EXPORT_WORKER_MAX_ROWS', 5_000);
  private readonly defaultMaxArtifactsPerJob = this.resolveNumberEnv('EXPORT_WORKER_MAX_ARTIFACTS_PER_JOB', 25);
  private readonly defaultMaxRunsPerJob = this.resolveNumberEnv('EXPORT_WORKER_MAX_RUN_HISTORY_PER_JOB', 50);
  private readonly retryBaseMs = this.resolveNumberEnv('EXPORT_WORKER_RETRY_BASE_MS', 5 * 60_000);
  private readonly retryMaxMs = this.resolveNumberEnv('EXPORT_WORKER_RETRY_MAX_MS', 6 * 60 * 60_000);
  private readonly artifactsDir = path.resolve(
    process.cwd(),
    process.env.EXPORT_ARTIFACTS_DIR?.trim() || 'output/scheduled-exports',
  );

  private readonly requestedStorageBackend: ExportStorageBackend = process.env.EXPORT_STORAGE_BACKEND?.trim().toLowerCase() === 's3'
    ? 's3'
    : 'local';
  private readonly s3Bucket = process.env.EXPORT_S3_BUCKET?.trim() || '';
  private readonly s3Prefix = this.normalizeStoragePrefix(process.env.EXPORT_S3_PREFIX?.trim() || 'scheduled-exports');
  private readonly signedUrlTtlSeconds = this.resolveNumberEnv('EXPORT_S3_SIGNED_URL_TTL_SECONDS', 15 * 60);
  private readonly s3Client = this.buildS3Client();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.jobsEnabled) {
      this.logger.log('Scheduled export worker disabled.');
      return;
    }

    this.logger.log(
      `Scheduled export worker enabled (interval=${this.intervalMs}ms, batch=${this.batchSize}, storage=${this.getStorageBackend()}).`,
    );

    this.timer = setInterval(() => {
      void this.runDueJobsOnce();
    }, this.intervalMs);

    // Run one cycle at startup so due jobs execute immediately after boot.
    void this.runDueJobsOnce();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runDueJobsOnce() {
    if (!this.jobsEnabled || this.workerRunning) {
      return 0;
    }

    this.workerRunning = true;
    const scanLock = this.getLockParts(SCAN_LOCK_KEY);

    try {
      const acquired = await this.tryAdvisoryLock(scanLock);
      if (!acquired) {
        return 0;
      }

      try {
        const state = await this.loadState();
        const now = Date.now();
        const dueJobs = state.jobs
          .filter((job) => job.enabled && job.lastResult !== 'running' && new Date(job.nextRunAt).getTime() <= now)
          .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
          .slice(0, this.batchSize);

        let processed = 0;
        for (const job of dueJobs) {
          await this.executeJob(job.id, 'scheduled', null);
          processed += 1;
        }

        if (processed > 0) {
          this.logger.log(`Scheduled export worker processed ${processed} job(s).`);
        }

        return processed;
      } finally {
        await this.releaseAdvisoryLock(scanLock);
      }
    } catch (error) {
      this.logger.error(`Scheduled export worker failed: ${this.toErrorMessage(error)}`);
      return 0;
    } finally {
      this.workerRunning = false;
    }
  }

  async runJobNow(jobId: string, actorEmail?: string | null) {
    const normalizedId = jobId.trim();
    if (!normalizedId) {
      throw new BadRequestException('Export job id is required.');
    }

    return this.executeJob(normalizedId, 'manual', actorEmail);
  }

  async listJobArtifacts(jobId: string, limitInput?: unknown) {
    const normalizedId = jobId.trim();
    if (!normalizedId) {
      throw new BadRequestException('Export job id is required.');
    }

    const state = await this.loadState();
    if (!state.jobs.some((job) => job.id === normalizedId)) {
      throw new NotFoundException('Scheduled export job not found.');
    }

    const requested = typeof limitInput === 'string' ? Number.parseInt(limitInput, 10) : Number(limitInput);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 20;

    const items = state.artifacts
      .filter((artifact) => artifact.jobId === normalizedId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((artifact) => ({
        id: artifact.id,
        jobId: artifact.jobId,
        fileName: artifact.fileName,
        format: artifact.format,
        dataset: artifact.dataset,
        contentType: artifact.contentType,
        byteSize: artifact.byteSize,
        checksum: artifact.checksum,
        trigger: artifact.trigger,
        createdAt: artifact.createdAt,
        storageBackend: artifact.storageBackend,
      }));

    return {
      items,
      total: state.artifacts.filter((artifact) => artifact.jobId === normalizedId).length,
    };
  }

  async listJobRunHistory(jobId: string, limitInput?: unknown) {
    const normalizedId = jobId.trim();
    if (!normalizedId) {
      throw new BadRequestException('Export job id is required.');
    }

    const state = await this.loadState();
    if (!state.jobs.some((job) => job.id === normalizedId)) {
      throw new NotFoundException('Scheduled export job not found.');
    }

    const requested = typeof limitInput === 'string' ? Number.parseInt(limitInput, 10) : Number(limitInput);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 20;

    const items = state.runs
      .filter((run) => run.jobId === normalizedId)
      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
      .slice(0, limit);

    return {
      items,
      total: state.runs.filter((run) => run.jobId === normalizedId).length,
    };
  }

  async getExportArtifactDownload(jobId: string, artifactId?: string | null): Promise<ExportArtifactDownload> {
    const normalizedId = jobId.trim();
    if (!normalizedId) {
      throw new BadRequestException('Export job id is required.');
    }

    const state = await this.loadState();
    if (!state.jobs.some((job) => job.id === normalizedId)) {
      throw new NotFoundException('Scheduled export job not found.');
    }

    const artifacts = state.artifacts
      .filter((artifact) => artifact.jobId === normalizedId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (artifacts.length === 0) {
      throw new NotFoundException('No generated artifacts found for this export job.');
    }

    const selected = artifactId
      ? artifacts.find((artifact) => artifact.id === artifactId.trim())
      : artifacts[0];

    if (!selected) {
      throw new NotFoundException('Requested export artifact was not found.');
    }

    if (selected.storageBackend === 's3') {
      const redirectUrl = await this.createSignedUrl(selected);
      if (!redirectUrl) {
        throw new BadRequestException('S3 storage is configured but signed URLs are unavailable.');
      }

      return {
        artifact: selected,
        localFilePath: null,
        redirectUrl,
      };
    }

    if (!selected.filePath) {
      throw new NotFoundException('Export artifact file path is not available.');
    }

    await fs.access(selected.filePath).catch(() => {
      throw new NotFoundException('Export artifact file no longer exists on disk.');
    });

    return {
      artifact: selected,
      localFilePath: selected.filePath,
      redirectUrl: null,
    };
  }

  async getExportArtifactSignedUrl(jobId: string, artifactId?: string | null) {
    const download = await this.getExportArtifactDownload(jobId, artifactId);
    if (download.redirectUrl) {
      return {
        url: download.redirectUrl,
        source: 's3' as const,
        expiresInSeconds: this.signedUrlTtlSeconds,
      };
    }

    return {
      url: null,
      source: 'api' as const,
      expiresInSeconds: null,
    };
  }

  private async executeJob(jobId: string, trigger: ExportRunTrigger, actorEmail?: string | null) {
    if (this.inFlightJobIds.has(jobId)) {
      const state = await this.loadState();
      const current = state.jobs.find((job) => job.id === jobId);
      if (!current) {
        throw new NotFoundException('Scheduled export job not found.');
      }
      return current;
    }

    this.inFlightJobIds.add(jobId);
    const jobLock = this.getLockParts(`platform-export-job-${jobId}`);
    const startedAtEpoch = Date.now();
    const startedAtIso = new Date(startedAtEpoch).toISOString();

    try {
      const acquired = await this.tryAdvisoryLock(jobLock);
      if (!acquired) {
        const state = await this.loadState();
        const current = state.jobs.find((job) => job.id === jobId);
        if (!current) {
          throw new NotFoundException('Scheduled export job not found.');
        }
        return current;
      }

      try {
        const state = await this.loadState();
        const index = state.jobs.findIndex((job) => job.id === jobId);
        if (index === -1) {
          throw new NotFoundException('Scheduled export job not found.');
        }

        const current = state.jobs[index];
        if (trigger === 'scheduled' && !current.enabled) {
          return current;
        }

        const running: ScheduledExportJob = {
          ...current,
          lastResult: 'running',
          lastError: null,
          lastAttemptAt: startedAtIso,
          updatedAt: startedAtIso,
        };

        const runningJobs = [...state.jobs];
        runningJobs[index] = running;
        await this.saveState(
          {
            jobs: runningJobs,
            artifacts: state.artifacts,
            runs: state.runs,
          },
          actorEmail,
        );

        const dataset = await this.loadDatasetRows(running.dataset);
        const writeResult = await this.writeArtifact(running, dataset, trigger);

        const successState = await this.loadState();
        const successIndex = successState.jobs.findIndex((job) => job.id === jobId);
        if (successIndex === -1) {
          throw new NotFoundException('Scheduled export job not found after execution.');
        }

        const completedAt = new Date();
        const completedAtIso = completedAt.toISOString();
        const durationMs = Date.now() - startedAtEpoch;
        const previous = successState.jobs[successIndex];

        const successJob: ScheduledExportJob = {
          ...previous,
          lastRunAt: completedAtIso,
          lastResult: 'success',
          lastError: null,
          lastRunDurationMs: durationMs,
          lastArtifactId: writeResult.artifact.id,
          lastArtifactGeneratedAt: writeResult.artifact.createdAt,
          consecutiveFailures: 0,
          nextRunAt: this.computeNextRunAt(previous.cadence, completedAt),
          updatedAt: completedAtIso,
        };

        const successJobs = [...successState.jobs];
        successJobs[successIndex] = successJob;

        const successRun: ScheduledExportRun = {
          id: randomUUID(),
          jobId,
          trigger,
          status: 'success',
          startedAt: startedAtIso,
          endedAt: completedAtIso,
          durationMs,
          error: null,
          artifactId: writeResult.artifact.id,
        };

        const nextArtifacts = await this.trimArtifacts(
          [writeResult.artifact, ...successState.artifacts],
          successJobs,
        );
        const nextRuns = this.trimRuns([successRun, ...successState.runs], successJobs);

        await this.saveState(
          {
            jobs: successJobs,
            artifacts: nextArtifacts,
            runs: nextRuns,
          },
          actorEmail,
        );

        await this.prisma.outboxMessage.create({
          data: {
            tenantId: null,
            templateId: 'platform.export-job.executed',
            recipient: actorEmail?.trim().toLowerCase() || successJob.createdByEmail || 'platform@noxera.plus',
            payload: {
              id: successJob.id,
              name: successJob.name,
              dataset: successJob.dataset,
              format: successJob.format,
              artifactId: writeResult.artifact.id,
              trigger,
            } as Prisma.InputJsonValue,
            status: 'Sent',
          },
        }).catch(() => undefined);

        return successJob;
      } finally {
        await this.releaseAdvisoryLock(jobLock);
      }
    } catch (error) {
      const failedState = await this.loadState();
      const failedIndex = failedState.jobs.findIndex((job) => job.id === jobId);

      if (failedIndex >= 0) {
        const failedAt = new Date();
        const failedAtIso = failedAt.toISOString();
        const durationMs = Date.now() - startedAtEpoch;
        const current = failedState.jobs[failedIndex];
        const nextFailureCount = (current.consecutiveFailures ?? 0) + 1;

        const failedJob: ScheduledExportJob = {
          ...current,
          lastRunAt: failedAtIso,
          lastResult: 'failed',
          lastError: this.toErrorMessage(error).slice(0, 500),
          lastRunDurationMs: durationMs,
          consecutiveFailures: nextFailureCount,
          nextRunAt: this.computeRetryRunAt(failedAt, nextFailureCount),
          updatedAt: failedAtIso,
        };

        const failedJobs = [...failedState.jobs];
        failedJobs[failedIndex] = failedJob;

        const failedRun: ScheduledExportRun = {
          id: randomUUID(),
          jobId,
          trigger,
          status: 'failed',
          startedAt: startedAtIso,
          endedAt: failedAtIso,
          durationMs,
          error: failedJob.lastError ?? null,
          artifactId: null,
        };

        const nextRuns = this.trimRuns([failedRun, ...failedState.runs], failedJobs);

        await this.saveState(
          {
            jobs: failedJobs,
            artifacts: failedState.artifacts,
            runs: nextRuns,
          },
          actorEmail,
        );

        await this.prisma.outboxMessage.create({
          data: {
            tenantId: null,
            templateId: 'platform.export-job.failed',
            recipient: actorEmail?.trim().toLowerCase() || failedJob.createdByEmail || 'platform@noxera.plus',
            payload: {
              id: failedJob.id,
              name: failedJob.name,
              dataset: failedJob.dataset,
              error: failedJob.lastError,
              retryAt: failedJob.nextRunAt,
              consecutiveFailures: nextFailureCount,
            } as Prisma.InputJsonValue,
            status: 'Pending',
          },
        }).catch(() => undefined);

        return failedJob;
      }

      throw error;
    } finally {
      this.inFlightJobIds.delete(jobId);
    }
  }

  private async loadDatasetRows(datasetInput: string): Promise<ExportDataset> {
    const dataset = datasetInput.trim().toLowerCase();

    if (dataset === 'users' || dataset === 'platform-users') {
      const users = await this.prisma.user.findMany({
        take: this.maxRowsPerExport,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          tenant: { select: { id: true, name: true } },
          role: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      return {
        title: 'Platform Users Export',
        rows: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          isSuperAdmin: user.isSuperAdmin,
          tenant: user.tenant?.name ?? '',
          role: user.role?.name ?? '',
          branch: user.branch?.name ?? '',
          invitedAt: user.invitedAt.toISOString(),
          activatedAt: user.activatedAt?.toISOString() ?? '',
          lastLoginAt: user.lastLoginAt?.toISOString() ?? '',
          createdAt: user.createdAt.toISOString(),
        })),
      };
    }

    if (dataset === 'tenants') {
      const tenants = await this.prisma.tenant.findMany({
        take: this.maxRowsPerExport,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          plan: { select: { id: true, name: true, price: true } },
          _count: {
            select: {
              users: true,
              members: true,
              branches: true,
            },
          },
        },
      });

      return {
        title: 'Tenants Export',
        rows: tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          domain: tenant.domain ?? '',
          status: tenant.status,
          plan: tenant.plan?.name ?? 'Trial',
          planPrice: tenant.plan?.price ?? 0,
          users: tenant._count.users,
          members: tenant._count.members,
          branches: tenant._count.branches,
          createdAt: tenant.createdAt.toISOString(),
          updatedAt: tenant.updatedAt.toISOString(),
        })),
      };
    }

    if (dataset === 'billing' || dataset === 'billing-tenants') {
      const tenants = await this.prisma.tenant.findMany({
        take: this.maxRowsPerExport,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          plan: { select: { id: true, name: true, price: true } },
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      return {
        title: 'Billing Export',
        rows: tenants.map((tenant) => ({
          tenantId: tenant.id,
          tenant: tenant.name,
          domain: tenant.domain ?? '',
          status: tenant.status,
          plan: tenant.plan?.name ?? 'Trial',
          monthlyPrice: tenant.plan?.price ?? 0,
          users: tenant._count.users,
          estimatedMrr: tenant.status === 'Active' ? (tenant.plan?.price ?? 0) : 0,
          createdAt: tenant.createdAt.toISOString(),
        })),
      };
    }

    if (dataset === 'support' || dataset === 'support-tickets') {
      const tickets = await this.prisma.supportTicket.findMany({
        take: this.maxRowsPerExport,
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          tenant: { select: { id: true, name: true, domain: true } },
        },
      });

      return {
        title: 'Support Tickets Export',
        rows: tickets.map((ticket) => ({
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          assignedTo: ticket.assignedTo ?? '',
          tenantId: ticket.tenantId,
          tenant: ticket.tenant.name,
          tenantDomain: ticket.tenant.domain ?? '',
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
        })),
      };
    }

    if (dataset === 'audit' || dataset === 'audit-logs') {
      const logs = await this.prisma.auditLog.findMany({
        take: this.maxRowsPerExport,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          tenant: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        title: 'Audit Logs Export',
        rows: logs.map((entry) => ({
          id: entry.id,
          tenant: entry.tenant.name,
          actorName: entry.user?.name ?? '',
          actorEmail: entry.user?.email ?? '',
          action: entry.action,
          resource: entry.resource,
          ipAddress: entry.ipAddress ?? '',
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    }

    throw new BadRequestException(`Unsupported dataset \"${datasetInput}\" for scheduled export.`);
  }

  private async writeArtifact(
    job: ScheduledExportJob,
    dataset: ExportDataset,
    trigger: ExportRunTrigger,
  ): Promise<ExportArtifactWriteResult> {
    const createdAt = new Date().toISOString();
    const artifactId = randomUUID();
    const safeName = this.toFileSafe(job.name || job.dataset);
    const stamp = createdAt.replace(/[:.]/g, '-');
    const extension = job.format;
    const fileName = `${safeName}-${stamp}-${artifactId.slice(0, 8)}.${extension}`;

    const rows = dataset.rows.length > 0
      ? dataset.rows
      : [{ message: 'No records available for selected dataset.' }];

    let buffer: Buffer;
    let contentType: string;

    if (job.format === 'csv') {
      buffer = Buffer.from(this.toCsv(rows), 'utf8');
      contentType = 'text/csv; charset=utf-8';
    } else if (job.format === 'json') {
      buffer = Buffer.from(JSON.stringify(rows, null, 2), 'utf8');
      contentType = 'application/json; charset=utf-8';
    } else if (job.format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
      const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      buffer = Buffer.isBuffer(xlsxBuffer) ? xlsxBuffer : Buffer.from(xlsxBuffer);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = await this.toPdfBuffer(dataset.title, rows);
      contentType = 'application/pdf';
    }

    const checksum = createHash('sha256').update(buffer).digest('hex');
    const storageBackend = this.getStorageBackend();

    if (storageBackend === 's3') {
      const key = this.s3Prefix ? `${this.s3Prefix}/${fileName}` : fileName;
      if (!this.s3Client || !this.s3Bucket) {
        throw new BadRequestException('S3 storage backend is selected, but client configuration is incomplete.');
      }

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          job_id: job.id,
          dataset: job.dataset,
          format: job.format,
        },
      }));

      return {
        artifact: {
          id: artifactId,
          jobId: job.id,
          fileName,
          format: job.format,
          dataset: job.dataset,
          contentType,
          byteSize: buffer.byteLength,
          checksum,
          trigger,
          createdAt,
          storageBackend: 's3',
          filePath: null,
          storageBucket: this.s3Bucket,
          storageKey: key,
        },
      };
    }

    await fs.mkdir(this.artifactsDir, { recursive: true });
    const filePath = path.join(this.artifactsDir, fileName);
    await fs.writeFile(filePath, buffer);

    return {
      artifact: {
        id: artifactId,
        jobId: job.id,
        fileName,
        format: job.format,
        dataset: job.dataset,
        contentType,
        byteSize: buffer.byteLength,
        checksum,
        trigger,
        createdAt,
        storageBackend: 'local',
        filePath,
        storageBucket: null,
        storageKey: null,
      },
    };
  }

  private toCsv(rows: ExportRow[]) {
    const keys = Array.from(
      rows.reduce((all, row) => {
        Object.keys(row).forEach((key) => all.add(key));
        return all;
      }, new Set<string>()),
    );

    const escape = (value: unknown) => {
      const normalized = value === null || value === undefined ? '' : String(value);
      if (/[,"\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
      }
      return normalized;
    };

    const lines = [keys.join(',')];
    for (const row of rows) {
      lines.push(keys.map((key) => escape(row[key] ?? '')).join(','));
    }

    return lines.join('\n');
  }

  private async toPdfBuffer(title: string, rows: ExportRow[]) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 36, size: 'A4' });

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(title);
      doc.moveDown(0.75);

      const maxRows = 300;
      const visibleRows = rows.slice(0, maxRows);
      for (const row of visibleRows) {
        const line = Object.entries(row)
          .map(([key, value]) => `${key}: ${value === null || value === undefined ? '' : String(value)}`)
          .join(' | ');
        doc.fontSize(9).text(line);
        doc.moveDown(0.25);
      }

      if (rows.length > maxRows) {
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Truncated ${rows.length - maxRows} additional row(s).`);
      }

      doc.end();
    });
  }

  private async trimArtifacts(artifacts: ScheduledExportArtifact[], jobs: ScheduledExportJob[]) {
    const perJobCount = new Map<string, number>();
    const retentionPerJob = new Map<string, number>();

    for (const job of jobs) {
      retentionPerJob.set(job.id, this.normalizePositiveInteger(job.maxArtifacts, this.defaultMaxArtifactsPerJob, 200));
    }

    const sorted = [...artifacts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const kept: ScheduledExportArtifact[] = [];

    for (const artifact of sorted) {
      const count = perJobCount.get(artifact.jobId) ?? 0;
      const retention = retentionPerJob.get(artifact.jobId) ?? this.defaultMaxArtifactsPerJob;
      if (count >= retention) {
        await this.deleteArtifactPayload(artifact);
        continue;
      }

      perJobCount.set(artifact.jobId, count + 1);
      kept.push(artifact);
    }

    return kept;
  }

  private trimRuns(runs: ScheduledExportRun[], jobs: ScheduledExportJob[]) {
    const perJobCount = new Map<string, number>();
    const retentionPerJob = new Map<string, number>();

    for (const job of jobs) {
      retentionPerJob.set(job.id, this.normalizePositiveInteger(job.maxRuns, this.defaultMaxRunsPerJob, 500));
    }

    const sorted = [...runs].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
    const kept: ScheduledExportRun[] = [];

    for (const run of sorted) {
      const count = perJobCount.get(run.jobId) ?? 0;
      const retention = retentionPerJob.get(run.jobId) ?? this.defaultMaxRunsPerJob;
      if (count >= retention) {
        continue;
      }

      perJobCount.set(run.jobId, count + 1);
      kept.push(run);
    }

    return kept;
  }

  private computeNextRunAt(cadence: string, from: Date) {
    const normalized = cadence.trim().toLowerCase();
    const base = new Date(from.getTime());

    const everyMatch = normalized.match(/every\s+(\d+)\s*(minute|hour|day|week|month)s?/i);
    if (everyMatch) {
      const amount = Number.parseInt(everyMatch[1], 10);
      const unit = everyMatch[2].toLowerCase();
      if (unit === 'minute') {
        base.setUTCMinutes(base.getUTCMinutes() + amount);
      } else if (unit === 'hour') {
        base.setUTCHours(base.getUTCHours() + amount);
      } else if (unit === 'day') {
        base.setUTCDate(base.getUTCDate() + amount);
      } else if (unit === 'week') {
        base.setUTCDate(base.getUTCDate() + (7 * amount));
      } else if (unit === 'month') {
        base.setUTCMonth(base.getUTCMonth() + amount);
      }
      return base.toISOString();
    }

    if (normalized.includes('hour')) {
      base.setUTCHours(base.getUTCHours() + 1);
      return base.toISOString();
    }

    if (normalized.includes('week') || /monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(normalized)) {
      base.setUTCDate(base.getUTCDate() + 7);
      return base.toISOString();
    }

    if (normalized.includes('month')) {
      base.setUTCMonth(base.getUTCMonth() + 1);
      return base.toISOString();
    }

    base.setUTCDate(base.getUTCDate() + 1);
    return base.toISOString();
  }

  private computeRetryRunAt(reference: Date, consecutiveFailures: number) {
    const safeFailures = Math.max(1, consecutiveFailures);
    const delay = Math.min(this.retryMaxMs, this.retryBaseMs * (2 ** (safeFailures - 1)));
    return new Date(reference.getTime() + delay).toISOString();
  }

  private normalizeStatus(value: unknown): ExportJobStatus {
    if (typeof value !== 'string') return 'queued';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'running' || normalized === 'success' || normalized === 'failed' || normalized === 'queued') {
      return normalized;
    }
    return 'queued';
  }

  private normalizeFormat(value: unknown): ScheduledExportFormat {
    if (typeof value !== 'string') return 'csv';
    const normalized = value.trim().toLowerCase();
    if (SUPPORTED_EXPORT_FORMATS.includes(normalized as ScheduledExportFormat)) {
      return normalized as ScheduledExportFormat;
    }
    return 'csv';
  }

  private normalizeIsoDate(value: unknown, fallback: Date) {
    if (typeof value !== 'string') return fallback.toISOString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return fallback.toISOString();
    }
    return date.toISOString();
  }

  private normalizePositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.min(parsed, max);
  }

  private normalizeJob(raw: unknown): ScheduledExportJob {
    const now = new Date();
    const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

    return {
      id: typeof source.id === 'string' && source.id.trim() ? source.id : randomUUID(),
      name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Scheduled export',
      dataset: typeof source.dataset === 'string' && source.dataset.trim() ? source.dataset : 'users',
      format: this.normalizeFormat(source.format),
      cadence: typeof source.cadence === 'string' && source.cadence.trim() ? source.cadence : 'Daily',
      enabled: source.enabled !== false,
      recipients: Array.isArray(source.recipients)
        ? source.recipients
          .filter((value) => typeof value === 'string')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
        : [],
      createdByEmail: typeof source.createdByEmail === 'string' ? source.createdByEmail : null,
      createdAt: this.normalizeIsoDate(source.createdAt, now),
      updatedAt: this.normalizeIsoDate(source.updatedAt, now),
      nextRunAt: this.normalizeIsoDate(source.nextRunAt, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      lastRunAt: typeof source.lastRunAt === 'string' ? this.normalizeIsoDate(source.lastRunAt, now) : null,
      lastResult: this.normalizeStatus(source.lastResult),
      lastError: typeof source.lastError === 'string' ? source.lastError : null,
      lastRunDurationMs: typeof source.lastRunDurationMs === 'number' ? source.lastRunDurationMs : null,
      lastArtifactId: typeof source.lastArtifactId === 'string' ? source.lastArtifactId : null,
      lastArtifactGeneratedAt: typeof source.lastArtifactGeneratedAt === 'string' ? source.lastArtifactGeneratedAt : null,
      lastAttemptAt: typeof source.lastAttemptAt === 'string' ? source.lastAttemptAt : null,
      consecutiveFailures: this.normalizePositiveInteger(source.consecutiveFailures, 0, 1_000),
      maxArtifacts: this.normalizePositiveInteger(source.maxArtifacts, this.defaultMaxArtifactsPerJob, 200),
      maxRuns: this.normalizePositiveInteger(source.maxRuns, this.defaultMaxRunsPerJob, 500),
    };
  }

  private normalizeArtifact(raw: unknown): ScheduledExportArtifact | null {
    const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : null;
    if (!source) return null;

    if (typeof source.id !== 'string' || !source.id.trim()) return null;
    if (typeof source.jobId !== 'string' || !source.jobId.trim()) return null;
    if (typeof source.fileName !== 'string' || !source.fileName.trim()) return null;

    const storageBackend = source.storageBackend === 's3' ? 's3' : 'local';
    const filePath = typeof source.filePath === 'string' && source.filePath.trim() ? source.filePath : null;
    const storageKey = typeof source.storageKey === 'string' && source.storageKey.trim() ? source.storageKey : null;

    if (storageBackend === 'local' && !filePath) return null;
    if (storageBackend === 's3' && !storageKey) return null;

    return {
      id: source.id,
      jobId: source.jobId,
      fileName: source.fileName,
      format: this.normalizeFormat(source.format),
      dataset: typeof source.dataset === 'string' ? source.dataset : 'users',
      contentType: typeof source.contentType === 'string' ? source.contentType : 'application/octet-stream',
      byteSize: typeof source.byteSize === 'number' ? source.byteSize : 0,
      checksum: typeof source.checksum === 'string' ? source.checksum : '',
      trigger: source.trigger === 'manual' ? 'manual' : 'scheduled',
      createdAt: this.normalizeIsoDate(source.createdAt, new Date()),
      storageBackend,
      filePath,
      storageBucket: typeof source.storageBucket === 'string' ? source.storageBucket : (storageBackend === 's3' ? this.s3Bucket : null),
      storageKey,
    };
  }

  private normalizeRun(raw: unknown): ScheduledExportRun | null {
    const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : null;
    if (!source) return null;

    if (typeof source.id !== 'string' || !source.id.trim()) return null;
    if (typeof source.jobId !== 'string' || !source.jobId.trim()) return null;

    const status = source.status === 'failed' ? 'failed' : source.status === 'success' ? 'success' : null;
    if (!status) return null;

    return {
      id: source.id,
      jobId: source.jobId,
      trigger: source.trigger === 'manual' ? 'manual' : 'scheduled',
      status,
      startedAt: this.normalizeIsoDate(source.startedAt, new Date()),
      endedAt: this.normalizeIsoDate(source.endedAt, new Date()),
      durationMs: typeof source.durationMs === 'number' ? Math.max(0, source.durationMs) : 0,
      error: typeof source.error === 'string' ? source.error : null,
      artifactId: typeof source.artifactId === 'string' ? source.artifactId : null,
    };
  }

  private async loadState(): Promise<ScheduledExportState> {
    const existing = await this.prisma.platformSetting.findUnique({ where: { key: SCHEDULED_EXPORT_JOBS_KEY } });

    if (!existing) {
      const fallback: ScheduledExportState = { jobs: [], artifacts: [], runs: [] };
      await this.prisma.platformSetting.create({
        data: {
          key: SCHEDULED_EXPORT_JOBS_KEY,
          value: fallback as unknown as Prisma.InputJsonValue,
        },
      });
      return fallback;
    }

    const value = (existing.value as Record<string, unknown> | null) ?? {};
    const jobs = Array.isArray(value.jobs)
      ? value.jobs.map((job) => this.normalizeJob(job))
      : [];
    const artifacts = Array.isArray(value.artifacts)
      ? value.artifacts
        .map((artifact) => this.normalizeArtifact(artifact))
        .filter((artifact): artifact is ScheduledExportArtifact => artifact !== null)
      : [];
    const runs = Array.isArray(value.runs)
      ? value.runs
        .map((run) => this.normalizeRun(run))
        .filter((run): run is ScheduledExportRun => run !== null)
      : [];

    return {
      jobs,
      artifacts,
      runs,
    };
  }

  private async saveState(state: ScheduledExportState, actorEmail?: string | null) {
    await this.prisma.platformSetting.upsert({
      where: { key: SCHEDULED_EXPORT_JOBS_KEY },
      update: {
        value: state as unknown as Prisma.InputJsonValue,
        updatedByEmail: actorEmail?.trim().toLowerCase() || null,
      },
      create: {
        key: SCHEDULED_EXPORT_JOBS_KEY,
        value: state as unknown as Prisma.InputJsonValue,
        updatedByEmail: actorEmail?.trim().toLowerCase() || null,
      },
    });
  }

  private async createSignedUrl(artifact: ScheduledExportArtifact) {
    if (!this.s3Client || !artifact.storageKey || !this.s3Bucket) {
      return null;
    }

    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: artifact.storageBucket || this.s3Bucket,
        Key: artifact.storageKey,
      }),
      { expiresIn: this.signedUrlTtlSeconds },
    );
  }

  private async deleteArtifactPayload(artifact: ScheduledExportArtifact) {
    if (artifact.storageBackend === 's3') {
      if (!this.s3Client || !artifact.storageKey || !this.s3Bucket) return;
      await this.s3Client
        .send(new DeleteObjectCommand({
          Bucket: artifact.storageBucket || this.s3Bucket,
          Key: artifact.storageKey,
        }))
        .catch(() => undefined);
      return;
    }

    if (!artifact.filePath) return;
    await fs.unlink(artifact.filePath).catch(() => undefined);
  }

  private async tryAdvisoryLock(lock: LockParts) {
    const rows = await this.prisma.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_lock(CAST(${lock.keyA} AS integer), CAST(${lock.keyB} AS integer)) AS acquired
    `;
    return rows[0]?.acquired === true;
  }

  private async releaseAdvisoryLock(lock: LockParts) {
    await this.prisma.$queryRaw`
      SELECT pg_advisory_unlock(CAST(${lock.keyA} AS integer), CAST(${lock.keyB} AS integer))
    `;
  }

  private getLockParts(lockKey: string): LockParts {
    const digest = createHash('sha256').update(lockKey).digest();
    return {
      keyA: digest.readInt32BE(0),
      keyB: digest.readInt32BE(4),
    };
  }

  private getStorageBackend(): ExportStorageBackend {
    if (this.requestedStorageBackend === 's3' && this.s3Client && this.s3Bucket) {
      return 's3';
    }
    return 'local';
  }

  private buildS3Client() {
    if (this.requestedStorageBackend !== 's3') {
      return null;
    }

    if (!this.s3Bucket) {
      this.logger.warn('EXPORT_STORAGE_BACKEND=s3 but EXPORT_S3_BUCKET is missing. Falling back to local artifact storage.');
      return null;
    }

    const region = process.env.EXPORT_S3_REGION?.trim() || 'us-east-1';
    const endpoint = process.env.EXPORT_S3_ENDPOINT?.trim();
    const forcePathStyle = this.resolveBooleanEnv('EXPORT_S3_FORCE_PATH_STYLE', false);

    return new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
    });
  }

  private normalizeStoragePrefix(value: string) {
    return value.replace(/^\/+|\/+$/g, '');
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Unknown export worker error.';
  }

  private resolveBooleanEnv(name: string, fallback: boolean) {
    const value = process.env[name];
    if (!value) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private resolveNumberEnv(name: string, fallback: number) {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return value;
  }

  private toFileSafe(input: string) {
    const normalized = input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'scheduled-export';
  }
}
