import { ConfigService } from "@nestjs/config";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

interface EncryptedValue {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
}

interface LoginTransaction {
  readonly state: string;
  readonly verifier: string;
  readonly redirectUri: string;
}

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

@Injectable()
export class SessionCryptoService {
  private readonly encryptionKey: Buffer;
  private readonly signingSecret: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.encryptionKey = createHash("sha256")
      .update(config.getOrThrow<string>("SESSION_ENCRYPTION_KEY"))
      .digest();
    this.signingSecret = config.getOrThrow<string>("SESSION_SIGNING_SECRET");
  }

  randomToken(bytes = 32): string {
    return base64Url(randomBytes(bytes));
  }

  hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  encrypt(value: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      ciphertext: base64Url(ciphertext),
      iv: base64Url(iv),
      tag: base64Url(cipher.getAuthTag()),
    };
  }

  decrypt(value: EncryptedValue): string {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        Buffer.from(value.iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new UnauthorizedException("The encrypted session value is invalid");
    }
  }

  sealLoginTransaction(transaction: LoginTransaction): string {
    const encrypted = this.encrypt(JSON.stringify(transaction));
    return [encrypted.iv, encrypted.tag, encrypted.ciphertext].join(".");
  }

  openLoginTransaction(value: string): LoginTransaction {
    const [iv, tag, ciphertext] = value.split(".");
    if (!iv || !tag || !ciphertext) {
      throw new UnauthorizedException("The login transaction is invalid");
    }
    return JSON.parse(this.decrypt({ iv, tag, ciphertext })) as LoginTransaction;
  }

  signSessionCookie(tenantId: string, token: string): string {
    const payload = `${tenantId}.${token}`;
    const signature = createHmac("sha256", this.signingSecret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  verifySessionCookie(cookie: string): { tenantId: string; token: string } {
    const [tenantId, token, signature] = cookie.split(".");
    if (!tenantId || !token || !signature) {
      throw new UnauthorizedException("The session cookie is invalid");
    }
    const payload = `${tenantId}.${token}`;
    const expected = createHmac("sha256", this.signingSecret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException("The session cookie signature is invalid");
    }
    return { tenantId, token };
  }
}
