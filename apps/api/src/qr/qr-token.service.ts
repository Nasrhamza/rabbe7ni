import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { qrPayloadSchema, type QrPayload } from "./dto.js";

@Injectable()
export class QrTokenService {
  private readonly secret: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.secret = config.getOrThrow<string>("SESSION_SIGNING_SECRET");
  }

  issue(input: Omit<QrPayload, "v" | "nonce">): {
    token: string;
    payload: QrPayload;
    hash: string;
  } {
    const payload: QrPayload = {
      v: 1,
      nonce: randomBytes(18).toString("base64url"),
      ...input,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.signature(encoded);
    const token = `${encoded}.${signature}`;
    return { token, payload, hash: this.hash(token) };
  }

  verify(token: string, now = Date.now()): QrPayload {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) throw new UnauthorizedException("Invalid QR token format");
    const expected = Buffer.from(this.signature(encoded), "base64url");
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException("Invalid QR signature");
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("Invalid QR payload");
    }
    const parsed = qrPayloadSchema.safeParse(decoded);
    if (!parsed.success) throw new UnauthorizedException("Invalid QR claims");
    if (parsed.data.exp * 1_000 <= now) throw new UnauthorizedException("QR token has expired");
    return parsed.data;
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private signature(encoded: string): string {
    return createHmac("sha256", this.secret).update(encoded).digest("base64url");
  }
}
