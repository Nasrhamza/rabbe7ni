import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { RoleScope } from "@rabbehni/database";

import { parseDto } from "../common/validation.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import {
  assignStaffRolesSchema,
  inviteStaffSchema,
  staffIdSchema,
  staffListSchema,
  staffStatusSchema,
  updateStaffAssignmentSchema,
  type AssignStaffRolesDto,
  type InviteStaffDto,
  type StaffListDto,
  type StaffStatusDto,
  type UpdateStaffAssignmentDto,
} from "./dto.js";
import { StaffRepository } from "./staff.repository.js";

@Injectable()
export class StaffService {
  constructor(
    @Inject(StaffRepository) private readonly staff: StaffRepository,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
  ) {}

  async invite(input: InviteStaffDto) {
    const body = parseDto(inviteStaffSchema, input);
    await this.assertNoPrivilegeEscalation(body.roleIds, body);
    return this.require(await this.staff.invite(body));
  }

  list(input: StaffListDto = {}) {
    return this.staff.list(parseDto(staffListSchema, input));
  }

  listRoles() {
    return this.staff.listRoles();
  }

  async get(id: string) {
    return this.require(await this.staff.findById(parseDto(staffIdSchema, id)));
  }

  async updateAssignment(id: string, input: UpdateStaffAssignmentDto) {
    return this.require(
      await this.staff.updateAssignment(
        parseDto(staffIdSchema, id),
        parseDto(updateStaffAssignmentSchema, input),
      ),
    );
  }

  async assignRoles(id: string, input: AssignStaffRolesDto) {
    const body = parseDto(assignStaffRolesSchema, input);
    const existing = await this.get(id);
    await this.assertNoPrivilegeEscalation(body.roleIds, existing);
    return this.require(await this.staff.assignRoles(parseDto(staffIdSchema, id), body.roleIds));
  }

  async changeStatus(id: string, input: StaffStatusDto) {
    const body = parseDto(staffStatusSchema, input);
    const principal = this.context.authenticatedPrincipal();
    const existing = await this.get(id);
    if (existing.userId === principal.userId && body.status !== "ACTIVE") {
      throw new ForbiddenException("A staff member cannot suspend or remove their own access");
    }
    return this.require(await this.staff.changeStatus(parseDto(staffIdSchema, id), body.status));
  }

  private async assertNoPrivilegeEscalation(
    roleIds: readonly string[],
    scope: {
      readonly organizationId: string;
      readonly franchiseId?: string | null | undefined;
      readonly merchantId?: string | null | undefined;
      readonly branchId?: string | null | undefined;
    },
  ): Promise<void> {
    const roles = await this.staff.roleGrants(roleIds);
    if (roles.length !== new Set(roleIds).size) throw new BadRequestException("Unknown role");
    const principal = this.context.authenticatedPrincipal();
    if (
      roles.some((role) => role.system && role.code === "owner") &&
      !principal.roles.includes("owner")
    ) {
      throw new ForbiddenException("Only an owner can assign the owner role");
    }
    const requestedPermissions = new Set(
      roles.flatMap((role) => role.permissions.map(({ permission }) => permission.code)),
    );
    const granted = new Set(principal.permissions);
    const escalated = [...requestedPermissions].filter((permission) => !granted.has(permission));
    if (escalated.length > 0) {
      throw new ForbiddenException(`Role assignment would escalate: ${escalated.join(", ")}`);
    }
    for (const role of roles) {
      if (!this.scopeSupportsRole(role.scope, scope)) {
        throw new BadRequestException(
          `Role ${role.code} is incompatible with the assignment scope`,
        );
      }
    }
  }

  private scopeSupportsRole(
    roleScope: RoleScope,
    scope: {
      readonly organizationId: string;
      readonly franchiseId?: string | null | undefined;
      readonly merchantId?: string | null | undefined;
      readonly branchId?: string | null | undefined;
    },
  ): boolean {
    if (roleScope === "ORGANIZATION") return Boolean(scope.organizationId);
    if (roleScope === "FRANCHISE") return Boolean(scope.franchiseId);
    if (roleScope === "MERCHANT") return Boolean(scope.merchantId);
    return Boolean(scope.branchId);
  }

  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Staff member or assignment boundary is invalid");
    return value;
  }
}
