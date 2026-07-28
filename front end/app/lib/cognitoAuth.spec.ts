import { describe, expect, it } from "vitest";

import { parseConfiguredSocialProviders } from "./cognitoAuth";

describe("parseConfiguredSocialProviders", () => {
  it("defaults to no advertised social providers", () => {
    expect(parseConfiguredSocialProviders(undefined)).toEqual([]);
    expect(parseConfiguredSocialProviders("")).toEqual([]);
  });

  it("accepts supported providers and removes duplicates", () => {
    expect(
      parseConfiguredSocialProviders(
        "Google, SignInWithApple facebook google",
      ),
    ).toEqual(["Google", "SignInWithApple", "Facebook"]);
  });

  it("ignores unknown providers", () => {
    expect(parseConfiguredSocialProviders("GitHub, Microsoft")).toEqual([]);
  });
});
