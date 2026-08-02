ALTER TABLE "subscription_changes"
ADD COLUMN "idempotency_key" TEXT NOT NULL;

CREATE UNIQUE INDEX "subscription_changes_tenant_id_idempotency_key_key"
ON "subscription_changes"("tenant_id", "idempotency_key");
