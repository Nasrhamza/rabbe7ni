import { describe, expect, it } from "vitest";

import { redisConnectionOptions } from "./index.js";

describe("redisConnectionOptions", () => {
  it("parses an authenticated Redis URL", () => {
    expect(redisConnectionOptions("redis://user:secret@localhost:6380/2")).toMatchObject({
      db: 2,
      host: "localhost",
      password: "secret",
      port: 6380,
      username: "user",
    });
  });
});
