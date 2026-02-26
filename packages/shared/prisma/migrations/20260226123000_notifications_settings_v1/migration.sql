-- Notifications, platform settings, and release controls.

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'tenant',
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "targetUserId" TEXT,
  "targetEmail" TEXT,
  "meta" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderSchedule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'platform',
  "eventType" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "triggerOffsetDays" INTEGER,
  "lastTriggeredAt" TIMESTAMP(3),
  "nextTriggerAt" TIMESTAMP(3),
  "escalationState" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReminderSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboxMessage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "templateId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rolloutStage" TEXT NOT NULL DEFAULT 'internal',
  "owner" TEXT,
  "tenantCohort" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_channel_category_key" ON "NotificationPreference"("userId", "channel", "category");
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

CREATE INDEX "Notification_scope_createdAt_idx" ON "Notification"("scope", "createdAt");
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");
CREATE INDEX "Notification_targetUserId_createdAt_idx" ON "Notification"("targetUserId", "createdAt");
CREATE INDEX "Notification_targetEmail_createdAt_idx" ON "Notification"("targetEmail", "createdAt");
CREATE INDEX "NotificationPreference_userId_channel_idx" ON "NotificationPreference"("userId", "channel");
CREATE INDEX "ReminderSchedule_scope_eventType_isActive_idx" ON "ReminderSchedule"("scope", "eventType", "isActive");
CREATE INDEX "ReminderSchedule_tenantId_eventType_idx" ON "ReminderSchedule"("tenantId", "eventType");
CREATE INDEX "OutboxMessage_status_createdAt_idx" ON "OutboxMessage"("status", "createdAt");
CREATE INDEX "OutboxMessage_tenantId_status_idx" ON "OutboxMessage"("tenantId", "status");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderSchedule"
ADD CONSTRAINT "ReminderSchedule_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutboxMessage"
ADD CONSTRAINT "OutboxMessage_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed release-control defaults used by web toggles.
INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rolloutStage", "owner", "tenantCohort", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'FEATURE_PLATFORM_SETTINGS_V1', 'Platform settings control plane', false, 'internal', 'platform', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FEATURE_NOTIFICATIONS_V1', 'In-app and email notification center', false, 'internal', 'platform', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FEATURE_REPORTS_V1', 'Real aggregated admin reports', false, 'internal', 'platform', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "ReminderSchedule" (
  "id",
  "scope",
  "eventType",
  "cadence",
  "isActive",
  "triggerOffsetDays",
  "createdAt",
  "updatedAt"
)
VALUES
  (gen_random_uuid()::text, 'platform', 'trial.expiry', 'daily', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'platform', 'trial.expiry', 'daily', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'platform', 'trial.expiry', 'daily', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'platform', 'subscription.renewal', 'daily', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'platform', 'subscription.renewal', 'daily', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
