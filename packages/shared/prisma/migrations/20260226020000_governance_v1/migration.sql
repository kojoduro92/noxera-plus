-- Governance v1: tenant user lifecycle, branch scoping, and role system hardening.

ALTER TABLE "Branch"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Invited',
ADD COLUMN "branchScopeMode" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "invitedByUserId" TEXT,
ADD COLUMN "activatedAt" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastSignInProvider" TEXT;

ALTER TABLE "Role"
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UserBranchAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBranchAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBranchAccess_userId_branchId_key" ON "UserBranchAccess"("userId", "branchId");
CREATE INDEX "UserBranchAccess_userId_idx" ON "UserBranchAccess"("userId");
CREATE INDEX "UserBranchAccess_branchId_idx" ON "UserBranchAccess"("branchId");

ALTER TABLE "UserBranchAccess"
ADD CONSTRAINT "UserBranchAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBranchAccess"
ADD CONSTRAINT "UserBranchAccess_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing users as active.
UPDATE "User"
SET
  "status" = 'Active',
  "invitedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "activatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "status" = 'Invited';

-- Backfill branch-restricted users using existing branchId preference.
INSERT INTO "UserBranchAccess" ("id", "userId", "branchId", "createdAt")
SELECT gen_random_uuid()::text, "id", "branchId", CURRENT_TIMESTAMP
FROM "User"
WHERE "branchId" IS NOT NULL
ON CONFLICT ("userId", "branchId") DO NOTHING;

UPDATE "User"
SET "branchScopeMode" = 'RESTRICTED'
WHERE "branchId" IS NOT NULL;

-- Remove duplicate role names per tenant before adding unique constraint.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "tenantId", LOWER("name") ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "Role"
)
DELETE FROM "Role"
WHERE "id" IN (
  SELECT "id" FROM ranked WHERE rn > 1
);

CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- Seed required system roles for each tenant if missing.
INSERT INTO "Role" ("id", "tenantId", "name", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", r."name", r."permissions", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (
  VALUES
    ('Owner', ARRAY[
      'branches.manage',
      'users.manage',
      'roles.manage',
      'members.manage',
      'services.manage',
      'attendance.manage',
      'giving.manage',
      'events.manage',
      'groups.manage',
      'website.manage',
      'reports.view'
    ]::text[]),
    ('Admin', ARRAY[
      'branches.manage',
      'users.manage',
      'members.manage',
      'services.manage',
      'attendance.manage',
      'giving.manage',
      'events.manage',
      'groups.manage',
      'website.manage',
      'reports.view'
    ]::text[]),
    ('Staff', ARRAY[
      'members.manage',
      'services.manage',
      'attendance.manage',
      'giving.manage',
      'events.manage',
      'groups.manage',
      'website.manage',
      'reports.view'
    ]::text[]),
    ('Viewer', ARRAY[
      'members.view',
      'services.view',
      'attendance.view',
      'giving.view',
      'events.view',
      'groups.view',
      'reports.view'
    ]::text[])
) AS r("name", "permissions")
LEFT JOIN "Role" existing
  ON existing."tenantId" = t."id" AND existing."name" = r."name"
WHERE existing."id" IS NULL;

-- Role fallback for users with null roleId.
WITH first_users AS (
  SELECT DISTINCT ON ("tenantId")
    "tenantId",
    "id" AS "userId"
  FROM "User"
  WHERE "tenantId" IS NOT NULL
  ORDER BY "tenantId", "createdAt" ASC, "id" ASC
)
UPDATE "User" u
SET "roleId" = owner_role."id"
FROM first_users fu
JOIN "Role" owner_role ON owner_role."tenantId" = fu."tenantId" AND owner_role."name" = 'Owner'
WHERE u."id" = fu."userId" AND u."roleId" IS NULL;

UPDATE "User" u
SET "roleId" = staff_role."id"
FROM "Role" staff_role
WHERE
  u."tenantId" = staff_role."tenantId"
  AND staff_role."name" = 'Staff'
  AND u."tenantId" IS NOT NULL
  AND u."roleId" IS NULL;
