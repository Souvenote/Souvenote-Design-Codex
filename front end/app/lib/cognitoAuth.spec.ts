import { describe, expect, it } from "vitest";

import {
  formatCognitoCodeDelivery,
  parseConfiguredSocialProviders,
} from "./cognitoAuth";

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

describe("formatCognitoCodeDelivery", () => {
  it("shows the masked destination returned by Cognito", () => {
    expect(
      formatCognitoCodeDelivery({
        DeliveryMedium: "EMAIL",
        Destination: "j***@e***",
      }),
    ).toBe(
      "We sent a confirmation code to j***@e***. Check your inbox and spam or junk folder.",
    );
  });

  it("describes a resend when Cognito omits the destination", () => {
    expect(formatCognitoCodeDelivery(undefined, { resent: true })).toBe(
      "We sent a new confirmation code to your email address. Check your inbox and spam or junk folder.",
    );
  });
});
