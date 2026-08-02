import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_ROUTE } from "../common/security.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly cookieName: string;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) config: ConfigService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
  ) {
    this.cookieName = config.getOrThrow<string>("SESSION_COOKIE_NAME");
  }

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = executionContext.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = this.firstHeader(request.headers.authorization);
    const bearer = authorization?.match(/^Bearer\s+(.+)$/iu)?.[1];
    const sessionCookie = request.cookies?.[this.cookieName];
    if (!bearer && !sessionCookie) {
      throw new UnauthorizedException("Authentication is required");
    }

    const principal = bearer
      ? await this.auth.authenticateBearer(bearer)
      : await this.auth.authenticateSession(sessionCookie as string);
    const requestContext = this.context.current();
    if (
      requestContext.requestedTenantId &&
      requestContext.requestedTenantId !== principal.tenantId
    ) {
      throw new ForbiddenException("The requested tenant does not match the authenticated tenant");
    }
    request.principal = principal;
    this.context.bindIdentity(principal);
    return true;
  }

  private firstHeader(value: string | readonly string[] | undefined): string | undefined {
    return typeof value === "string" ? value : value?.[0];
  }
}
