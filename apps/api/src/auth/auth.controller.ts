import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import { parseDto } from "../common/validation.js";
import { Public, RequirePermissions } from "../common/security.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedPrincipal, AuthenticatedRequest } from "./auth.types.js";
import { CurrentUser } from "./auth.decorators.js";
import {
  callbackQuerySchema,
  customerRegistrationSchema,
  emailVerificationSchema,
  loginQuerySchema,
  merchantRegistrationSchema,
  passwordResetSchema,
  slugAvailabilitySchema,
} from "./dto.js";
import { PublicThrottle } from "../common/public-throttle.guard.js";

@ApiTags("authentication")
@Controller({
  path: "auth",
  version: "1",
})
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Get("login")
  @ApiOperation({ summary: "Start the Keycloak OIDC authorization-code flow with PKCE" })
  async login(@Query() rawQuery: unknown, @Res() reply: FastifyReply): Promise<void> {
    const query = parseDto(loginQuerySchema, rawQuery);
    const result = await this.auth.startLogin(query.redirect_uri, query.locale);
    reply.setCookie(
      this.auth.transactionCookieName,
      result.transactionCookie,
      this.auth.transactionCookieOptions,
    );
    reply.status(302).header("location", result.authorizationUrl).send();
  }

  @Public()
  @Get("callback")
  @ApiOperation({ summary: "Complete OIDC login and create an opaque server-side session" })
  async callback(
    @Query() rawQuery: unknown,
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const query = parseDto(callbackQuerySchema, rawQuery);
    const transactionCookie = request.cookies?.[this.auth.transactionCookieName];
    if (!transactionCookie) {
      throw new UnauthorizedException("The OIDC transaction cookie is missing");
    }
    const result = await this.auth.completeLogin(
      query.code,
      query.state,
      transactionCookie,
      this.fingerprint(request),
    );
    reply.clearCookie(this.auth.transactionCookieName, { path: "/v1/auth" });
    reply.setCookie(
      this.auth.sessionCookieName,
      result.sessionCookie,
      this.auth.sessionCookieOptions,
    );
    reply.status(302).header("location", result.redirectUri).send();
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke the local session and the Keycloak refresh token" })
  async logout(@Req() request: AuthenticatedRequest, @Res() reply: FastifyReply): Promise<void> {
    await this.auth.logout(request.cookies?.[this.auth.sessionCookieName]);
    reply.clearCookie(this.auth.sessionCookieName, { path: "/" }).status(204).send();
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate the Keycloak refresh token for the current session" })
  refresh(@Req() request: AuthenticatedRequest) {
    const cookie = request.cookies?.[this.auth.sessionCookieName];
    if (!cookie) {
      throw new BadRequestException("A browser session is required to refresh");
    }
    return this.auth.refreshSession(cookie);
  }

  @Get("session")
  @ApiOperation({ summary: "Return the authenticated tenant-aware session" })
  session(@CurrentUser() principal: AuthenticatedPrincipal) {
    return { authenticated: true, principal };
  }

  @Get("permission-check")
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "Verify database-backed RBAC permission enforcement" })
  permissionCheck(@CurrentUser() principal: AuthenticatedPrincipal) {
    return {
      allowed: true,
      tenantId: principal.tenantId,
      permission: "tenant.read",
    };
  }

  @Public()
  @Post("password-reset")
  @HttpCode(202)
  @ApiOperation({ summary: "Request a Keycloak password-reset action email" })
  async passwordReset(@Body() rawBody: unknown) {
    const body = parseDto(passwordResetSchema, rawBody);
    await this.auth.requestPasswordReset(body.email, body.redirectUri);
    return {
      accepted: true,
      message: "If the account exists, password-reset instructions will be sent.",
    };
  }

  @Post("email-verification")
  @HttpCode(202)
  @ApiOperation({ summary: "Request a Keycloak email-verification action" })
  async emailVerification(
    @Body() rawBody: unknown,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    const body = parseDto(emailVerificationSchema, rawBody);
    await this.auth.requestEmailVerification(principal, body.redirectUri);
    return { accepted: true };
  }

  @Get("two-factor")
  @ApiOperation({ summary: "Return the current Keycloak OTP enrollment status" })
  twoFactorStatus(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.auth.twoFactorStatus(principal);
  }

  @Post("two-factor/setup")
  @HttpCode(202)
  @ApiOperation({ summary: "Request the secure Keycloak OTP enrollment flow" })
  async twoFactorSetup(@Body() rawBody: unknown, @CurrentUser() principal: AuthenticatedPrincipal) {
    const body = parseDto(emailVerificationSchema, rawBody);
    await this.auth.requestTwoFactorSetup(principal, body.redirectUri);
    return { accepted: true };
  }

  @Public()
  @Post("customer-registration")
  @HttpCode(201)
  @PublicThrottle({ bucket: "customer-registration", limit: 5, windowSeconds: 3_600 })
  @ApiOperation({ summary: "Register a tenant-scoped customer mobile account" })
  customerRegistration(@Body() rawBody: unknown) {
    return this.auth.registerCustomer(parseDto(customerRegistrationSchema, rawBody));
  }

  @Public()
  @Get("workspace-slug")
  @PublicThrottle({ bucket: "workspace-slug", limit: 60, windowSeconds: 60 })
  @ApiOperation({ summary: "Check whether a merchant workspace address is still free" })
  workspaceSlug(@Query() rawQuery: unknown) {
    const { slug } = parseDto(slugAvailabilitySchema, rawQuery);
    return this.auth.isWorkspaceSlugAvailable(slug);
  }

  @Public()
  @Post("merchant-registration")
  @HttpCode(201)
  @PublicThrottle({ bucket: "merchant-registration", limit: 3, windowSeconds: 3_600 })
  @ApiOperation({
    summary: "Register a merchant and provision its tenant, first branch, owner and trial",
  })
  merchantRegistration(@Body() rawBody: unknown) {
    return this.auth.registerMerchant(parseDto(merchantRegistrationSchema, rawBody));
  }

  private fingerprint(request: AuthenticatedRequest) {
    const userAgent = request.headers["user-agent"];
    return {
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(typeof userAgent === "string" ? { userAgent } : {}),
    };
  }
}
