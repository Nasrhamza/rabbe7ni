import { describe, expect, it } from "vitest";

import { parseRuntimeEnvironment } from "./index.js";

describe("parseRuntimeEnvironment", () => {
  it("applies safe foundation defaults", () => {
    expect(parseRuntimeEnvironment({})).toMatchObject({
      LOG_LEVEL: "info",
      NODE_ENV: "development",
      SERVICE_VERSION: "0.0.0",
    });
  });

  it("rejects an API environment without infrastructure URLs", async () => {
    const { parseApiEnvironment } = await import("./index.js");

    expect(() => parseApiEnvironment({})).toThrow();
  });
});
