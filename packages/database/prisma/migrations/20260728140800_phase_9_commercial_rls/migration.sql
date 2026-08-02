-- Phase 9 commercial, usage and branding records are tenant-owned.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'subscription_changes',
    'payment_intents',
    'invoices',
    'payment_transactions',
    'billing_webhooks',
    'usage_records',
    'tenant_quota_overrides',
    'white_label_profiles',
    'tenant_localizations',
    'custom_domains'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (
        tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
      ) WITH CHECK (
        tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
      )',
      table_name || '_tenant_isolation',
      table_name
    );
  END LOOP;
END
$$;
