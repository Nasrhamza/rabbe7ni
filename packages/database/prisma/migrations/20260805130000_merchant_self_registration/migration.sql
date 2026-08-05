-- Workspace slug availability for public merchant self-registration.
--
-- The tenants table enforces row level security keyed on its own id, so an application session can
-- only ever see the tenant it is already scoped to. A merchant registering for the first time has
-- no tenant, and therefore cannot query the table at all -- a plain SELECT returns no rows whether
-- or not the slug is taken, which would let the signup form report every slug as free and then fail
-- on the unique constraint at submit time.
--
-- This SECURITY DEFINER function answers the single question the signup form needs. It returns a
-- boolean and never exposes a tenant row, so it reveals exactly what a slug picker inherently
-- reveals and nothing more. EXECUTE is intentionally left at the PUBLIC default: the API calls it
-- from an unauthenticated route, and the return value carries no tenant data.
CREATE OR REPLACE FUNCTION "rabbehni_workspace_slug_available"(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM "tenants" WHERE "slug" = lower(trim(candidate))
  );
$$;
