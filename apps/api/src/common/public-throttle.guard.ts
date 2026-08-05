import { HttpException, HttpStatus, Inject, Injectable, SetMetadata } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REDIS_CLIENT } from "@rabbehni/cache/nest";
import type { FastifyRequest } from "fastify";

/** The slice of the Redis client this guard needs, so it does not depend on the driver package. */
interface CounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

export const PUBLIC_THROTTLE = "rabbehni:public-throttle";

export interface PublicThrottleOptions {
  /** Requests allowed from one client within the window. */
  readonly limit: number;
  /** Window length in seconds. */
  readonly windowSeconds: number;
  /** Distinguishes counters between routes that share a client. */
  readonly bucket: string;
}

/**
 * Restricts an unauthenticated route far below the global allowance.
 *
 * The platform-wide limit is 100 requests per minute, which is reasonable for ordinary traffic but
 * far too permissive for routes that create tenants or dispatch mail: at that rate a single client
 * could provision a hundred workspaces a minute. Routes carrying real side effects declare their
 * own budget with {@link PublicThrottle}.
 *
 * Counting lives in Redis rather than process memory so the budget holds across API replicas —
 * an in-memory counter would multiply the effective limit by the number of instances.
 */
export const PublicThrottle = (options: PublicThrottleOptions) =>
  SetMetadata(PUBLIC_THROTTLE, options);

@Injectable()
export class PublicThrottleGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: CounterStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<PublicThrottleOptions | undefined>(
      PUBLIC_THROTTLE,
      [context.getHandler(), context.getClass()],
    );
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = `throttle:${options.bucket}:${request.ip ?? "unknown"}`;

    let hits: number;
    try {
      // INCR then EXPIRE on first hit gives a fixed window without a read-modify-write race.
      hits = await this.redis.incr(key);
      if (hits === 1) {
        await this.redis.expire(key, options.windowSeconds);
      }
    } catch {
      // Fail closed: without a counter there is no abuse ceiling, and these routes create tenants
      // and dispatch mail. Redis is already a readiness dependency, so an unreachable store means
      // this instance should be out of rotation anyway — answer 503 rather than surfacing the
      // driver error as an opaque 500.
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: "Registration is temporarily unavailable. Please try again shortly.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (hits > options.limit) {
      const retryAfter = await this.redis.ttl(key).catch(() => options.windowSeconds);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many attempts. Please try again later.",
          retryAfterSeconds: retryAfter > 0 ? retryAfter : options.windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
