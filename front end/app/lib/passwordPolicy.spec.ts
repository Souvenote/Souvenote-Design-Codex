import { describe, expect, it } from "vitest";

import {
  PASSWORD_POLICY_DESCRIPTION,
  passwordPolicyError,
} from "./passwordPolicy";

describe("passwordPolicyError", () => {
  it("accepts the configured Cognito password policy", () => {
    expect(passwordPolicyError("StrongPassword1@")).toBeNull();
  });

  it.each([
    "Short1@",
    "NOLOWERCASE1@",
    "nouppercase1@",
    "NoNumberHere@",
    "NoSymbolHere1",
  ])("rejects passwords missing a configured requirement: %s", (password) => {
    expect(passwordPolicyError(password)).toBe(PASSWORD_POLICY_DESCRIPTION);
  });
});
