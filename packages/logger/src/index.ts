import { randomUUID } from "node:crypto";

import type { Options } from "pino-http";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "*.password",
  "*.token",
  "*.secret",
] as const;

export function createLoggerHttpOptions(service: string): Options {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    genReqId(request, response) {
      const incomingId = request.headers["x-request-id"];
      const requestId = typeof incomingId === "string" && incomingId ? incomingId : randomUUID();
      response.setHeader("x-request-id", requestId);
      return requestId;
    },
    customProps(request) {
      return {
        requestId: request.id,
        service,
      };
    },
    redact: {
      censor: "[REDACTED]",
      paths: [...REDACT_PATHS],
    },
  };
}
