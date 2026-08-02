import { describe, expect, it } from "vitest";

import { SystemController } from "../src/system.controller.js";

describe("SystemController", () => {
  it("reports the Phase 1 technical status", () => {
    const result = new SystemController().describe();

    expect(result).toMatchObject({
      phase: "1",
      service: "api",
      status: "ok",
    });
    expect(result.timestamp).toEqual(expect.any(String));
  });
});
