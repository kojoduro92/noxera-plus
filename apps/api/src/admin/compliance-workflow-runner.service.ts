import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

const SCAN_LOCK_KEY = 'platform-compliance-workflow-scan';

type LockParts = {
  keyA: number;
  keyB: number;
};

@Injectable()
export class ComplianceWorkflowRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComplianceWorkflowRunnerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly enabled = this.resolveBooleanEnv('COMPLIANCE_WORKFLOW_ENABLED', process.env.NODE_ENV !== 'test');
  private readonly intervalMs = this.resolveNumberEnv('COMPLIANCE_WORKFLOW_INTERVAL_MS', 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Compliance workflow automation runner disabled.');
      return;
    }

    this.logger.log(`Compliance workflow automation runner enabled (interval=${this.intervalMs}ms).`);

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);

    void this.runOnce();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce() {
    if (!this.enabled || this.running) {
      return;
    }

    this.running = true;
    const scanLock = this.getLockParts(SCAN_LOCK_KEY);

    try {
      const acquired = await this.tryAdvisoryLock(scanLock);
      if (!acquired) {
        return;
      }

      try {
        const result = await this.platformSettingsService.runComplianceAutomationCycle('platform-automation@noxera.plus');
        if (result.remindersSent > 0 || result.escalationsSent > 0 || result.completedAudits > 0) {
          this.logger.log(
            `Compliance automation cycle processed=${result.processed} reminders=${result.remindersSent} escalations=${result.escalationsSent} completionAudits=${result.completedAudits}`,
          );
        }
      } finally {
        await this.releaseAdvisoryLock(scanLock);
      }
    } catch (error) {
      this.logger.error(
        `Compliance automation cycle failed: ${error instanceof Error ? error.message : 'Unknown error.'}`,
      );
    } finally {
      this.running = false;
    }
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
}
