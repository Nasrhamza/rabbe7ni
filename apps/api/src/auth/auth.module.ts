import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuditModule } from "../audit/audit.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { TenantIsolationGuard } from "../tenancy/tenant-isolation.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthenticationGuard } from "./authentication.guard.js";
import { AuthorizationGuard } from "./authorization.guard.js";
import { KeycloakActionsService } from "./keycloak-actions.service.js";
import { OidcService } from "./oidc.service.js";
import { SessionCryptoService } from "./session-crypto.service.js";

@Module({
  imports: [TenancyModule, AuditModule],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    OidcService,
    SessionCryptoService,
    KeycloakActionsService,
    AuthenticationGuard,
    AuthorizationGuard,
    {
      provide: APP_GUARD,
      useExisting: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: TenantIsolationGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: AuthorizationGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
