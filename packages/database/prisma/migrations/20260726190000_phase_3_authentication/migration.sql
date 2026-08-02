CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token_hash" CHAR(64) NOT NULL,
    "refresh_token_ciphertext" TEXT NOT NULL,
    "refresh_token_iv" TEXT NOT NULL,
    "refresh_token_tag" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_session_token_hash_key"
    ON "auth_sessions"("session_token_hash");
CREATE UNIQUE INDEX "auth_sessions_id_tenant_id_key"
    ON "auth_sessions"("id", "tenant_id");
CREATE INDEX "auth_sessions_tenant_id_user_id_idx"
    ON "auth_sessions"("tenant_id", "user_id");
CREATE INDEX "auth_sessions_tenant_id_expires_at_idx"
    ON "auth_sessions"("tenant_id", "expires_at");
CREATE INDEX "auth_sessions_tenant_id_revoked_at_idx"
    ON "auth_sessions"("tenant_id", "revoked_at");

ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "auth_sessions_tenant_isolation"
    ON "auth_sessions"
    USING (
      "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
    WITH CHECK (
      "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "auth_sessions" TO rabbehni_app;
