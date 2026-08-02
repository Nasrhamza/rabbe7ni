import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedPrincipal } from "../src/auth/auth.types.js";
import type { TenantContextStore } from "../src/tenancy/tenant-context.store.js";
import type { StaffRepository } from "../src/staff/staff.repository.js";
import { StaffService } from "../src/staff/staff.service.js";

const principal: AuthenticatedPrincipal = {
  subject: "user",
  userId: "10000000-0000-4000-8000-000000000006",
  tenantId: "10000000-0000-4000-8000-000000000001",
  membershipId: "10000000-0000-4000-8000-000000000007",
  email: "manager@example.com",
  displayName: "Manager",
  locale: "fr",
  permissions: ["staff.read", "staff.manage"],
  roles: ["manager"],
  access: {
    organizationIds: ["10000000-0000-4000-8000-000000000002"],
    franchiseIds: [],
    merchantIds: [],
    branchIds: [],
    tenantWide: false,
  },
  authMethod: "session",
};

describe("Phase 4 staff permission boundaries", () => {
  it("blocks role assignment when it would grant a permission the actor does not own", async () => {
    const invite = vi.fn();
    const repository = {
      invite,
      roleGrants: vi.fn().mockResolvedValue([
        {
          id: "10000000-0000-4000-8000-000000000009",
          code: "tenant-owner",
          system: false,
          scope: "ORGANIZATION",
          permissions: [{ permission: { code: "tenant.manage" } }],
        },
      ]),
    } as unknown as StaffRepository;
    const context = {
      authenticatedPrincipal: () => principal,
    } as unknown as TenantContextStore;
    const service = new StaffService(repository, context);

    await expect(
      service.invite({
        email: "new@example.com",
        displayName: "New member",
        organizationId: "10000000-0000-4000-8000-000000000002",
        roleIds: ["10000000-0000-4000-8000-000000000009"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(invite).not.toHaveBeenCalled();
  });

  it("allows assignment of a role whose permissions are a subset of the actor grants", async () => {
    const invite = vi.fn().mockResolvedValue({ id: "staff-id" });
    const repository = {
      invite,
      roleGrants: vi.fn().mockResolvedValue([
        {
          id: "10000000-0000-4000-8000-000000000009",
          code: "staff-manager",
          system: false,
          scope: "ORGANIZATION",
          permissions: [{ permission: { code: "staff.read" } }],
        },
      ]),
    } as unknown as StaffRepository;
    const service = new StaffService(repository, {
      authenticatedPrincipal: () => principal,
    } as unknown as TenantContextStore);

    await expect(
      service.invite({
        email: "new@example.com",
        displayName: "New member",
        organizationId: "10000000-0000-4000-8000-000000000002",
        roleIds: ["10000000-0000-4000-8000-000000000009"],
      }),
    ).resolves.toEqual({ id: "staff-id" });
  });
});
