import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_ROUTE = "rabbehni:is-public";
export const REQUIRED_PERMISSIONS = "rabbehni:required-permissions";
export const REQUIRED_ENTITLEMENT = "rabbehni:required-entitlement";

export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const RequireEntitlement = (featureKey: string) =>
  SetMetadata(REQUIRED_ENTITLEMENT, featureKey);
