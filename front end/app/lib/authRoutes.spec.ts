import { describe, expect, it } from "vitest";

import { loginHrefAfterSignup } from "./authRoutes";

describe("post-signup authentication routes", () => {
  it("sends a newly created account to the dedicated first-login screen", () => {
    expect(
      loginHrefAfterSignup(" New.User@Example.com ", "/welcome", "created"),
    ).toBe(
      "/first-login?returnTo=%2Fwelcome&email=new.user%40example.com",
    );
  });

  it("sends an existing account to the returning-user login screen", () => {
    expect(
      loginHrefAfterSignup("returning@example.com", "/create", "exists"),
    ).toBe(
      "/login?returnTo=%2Fcreate&email=returning%40example.com&signup=exists",
    );
  });
});
