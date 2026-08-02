import { describe, expect, it } from "vitest";

import { SystemController } from "../src/system.controller.js";

describe("SystemController", () => {
  it("returns a technical-only status", () => {
    expect(new SystemController().describe()).toMatchObject({
      phase: "8",
      service: "analytics-service",
      status: "ok",
    });
  });
});
