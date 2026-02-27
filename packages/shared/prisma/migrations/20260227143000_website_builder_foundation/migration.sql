-- Website builder foundation (templates, revisions, assets, forms, analytics, domains)

CREATE TABLE "WebsiteTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'published',
  "description" TEXT,
  "previewImageUrl" TEXT,
  "schema" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteTemplate_key_key" ON "WebsiteTemplate"("key");

CREATE TABLE "WebsitePageRevision" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "content" JSONB NOT NULL,
  "seo" JSONB,
  "changeSummary" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePageRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsitePageRevision_pageId_version_key" ON "WebsitePageRevision"("pageId", "version");
CREATE INDEX "WebsitePageRevision_pageId_status_idx" ON "WebsitePageRevision"("pageId", "status");

CREATE TABLE "WebsiteThemeRevision" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "themeConfig" JSONB NOT NULL,
  "changeSummary" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteThemeRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteThemeRevision_websiteId_version_key" ON "WebsiteThemeRevision"("websiteId", "version");
CREATE INDEX "WebsiteThemeRevision_websiteId_status_idx" ON "WebsiteThemeRevision"("websiteId", "status");

CREATE TABLE "WebsitePublishLog" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "pageId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "diff" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePublishLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsitePublishLog_websiteId_createdAt_idx" ON "WebsitePublishLog"("websiteId", "createdAt");
CREATE INDEX "WebsitePublishLog_pageId_createdAt_idx" ON "WebsitePublishLog"("pageId", "createdAt");

CREATE TABLE "WebsiteAsset" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "fileSizeBytes" INTEGER,
  "altText" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteAsset_tenantId_createdAt_idx" ON "WebsiteAsset"("tenantId", "createdAt");
CREATE INDEX "WebsiteAsset_websiteId_createdAt_idx" ON "WebsiteAsset"("websiteId", "createdAt");

CREATE TABLE "WebsiteForm" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "schema" JSONB NOT NULL,
  "notificationConfig" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteForm_websiteId_key_key" ON "WebsiteForm"("websiteId", "key");
CREATE INDEX "WebsiteForm_tenantId_status_idx" ON "WebsiteForm"("tenantId", "status");

CREATE TABLE "WebsiteFormSubmission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "spamScore" INTEGER NOT NULL DEFAULT 0,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteFormSubmission_tenantId_createdAt_idx" ON "WebsiteFormSubmission"("tenantId", "createdAt");
CREATE INDEX "WebsiteFormSubmission_formId_createdAt_idx" ON "WebsiteFormSubmission"("formId", "createdAt");

CREATE TABLE "WebsitePreviewToken" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePreviewToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsitePreviewToken_token_key" ON "WebsitePreviewToken"("token");
CREATE INDEX "WebsitePreviewToken_websiteId_expiresAt_idx" ON "WebsitePreviewToken"("websiteId", "expiresAt");

CREATE TABLE "WebsiteDomain" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "verificationToken" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sslStatus" TEXT NOT NULL DEFAULT 'pending',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "redirectToCanonical" BOOLEAN NOT NULL DEFAULT true,
  "canonicalUrl" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteDomain_hostname_key" ON "WebsiteDomain"("hostname");
CREATE INDEX "WebsiteDomain_tenantId_status_idx" ON "WebsiteDomain"("tenantId", "status");
CREATE INDEX "WebsiteDomain_websiteId_isPrimary_idx" ON "WebsiteDomain"("websiteId", "isPrimary");

CREATE TABLE "WebsiteAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "pagePath" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "source" TEXT,
  "payload" JSONB,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteAnalyticsEvent_websiteId_createdAt_idx" ON "WebsiteAnalyticsEvent"("websiteId", "createdAt");
CREATE INDEX "WebsiteAnalyticsEvent_tenantId_eventType_createdAt_idx" ON "WebsiteAnalyticsEvent"("tenantId", "eventType", "createdAt");

ALTER TABLE "WebsitePageRevision"
  ADD CONSTRAINT "WebsitePageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteThemeRevision"
  ADD CONSTRAINT "WebsiteThemeRevision_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePublishLog"
  ADD CONSTRAINT "WebsitePublishLog_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePublishLog"
  ADD CONSTRAINT "WebsitePublishLog_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteAsset"
  ADD CONSTRAINT "WebsiteAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteAsset"
  ADD CONSTRAINT "WebsiteAsset_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteForm"
  ADD CONSTRAINT "WebsiteForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteForm"
  ADD CONSTRAINT "WebsiteForm_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteFormSubmission"
  ADD CONSTRAINT "WebsiteFormSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteFormSubmission"
  ADD CONSTRAINT "WebsiteFormSubmission_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteFormSubmission"
  ADD CONSTRAINT "WebsiteFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "WebsiteForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePreviewToken"
  ADD CONSTRAINT "WebsitePreviewToken_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteDomain"
  ADD CONSTRAINT "WebsiteDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteDomain"
  ADD CONSTRAINT "WebsiteDomain_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteAnalyticsEvent"
  ADD CONSTRAINT "WebsiteAnalyticsEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteAnalyticsEvent"
  ADD CONSTRAINT "WebsiteAnalyticsEvent_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
