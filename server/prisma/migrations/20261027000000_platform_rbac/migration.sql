-- Add scoped platform roles without changing or deleting existing accounts.
-- Existing platform administrators receive the least-privileged role and can
-- be explicitly promoted by an operator-controlled email allowlist.
ALTER TABLE "PlatformAdmin"
  ADD COLUMN IF NOT EXISTS "platformRole" TEXT NOT NULL DEFAULT 'READ_ONLY_AUDITOR';

CREATE TABLE IF NOT EXISTS "PlatformAdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorAdminId" TEXT,
  "targetAdminId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdminAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformAdminAuditLog_actorAdminId_fkey"
    FOREIGN KEY ("actorAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PlatformAdminAuditLog_createdAt_idx"
  ON "PlatformAdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminAuditLog_targetAdminId_createdAt_idx"
  ON "PlatformAdminAuditLog"("targetAdminId", "createdAt");
