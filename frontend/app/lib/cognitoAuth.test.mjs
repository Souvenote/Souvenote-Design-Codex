import assert from "node:assert/strict";
import test from "node:test";

import { cleanHostedUiReturnPath } from "./cognitoAuth.ts";

test("preserves safe internal post-login destinations", () => {
  assert.equal(
    cleanHostedUiReturnPath("/create/personalize-a-template?draft=123#preview", "/create"),
    "/create/personalize-a-template?draft=123#preview",
  );
  assert.equal(cleanHostedUiReturnPath("/welcome", "/create"), "/welcome");
});

test("rejects external and malformed post-login destinations", () => {
  for (const value of [
    "https://attacker.example/collect",
    "//attacker.example/collect",
    "/\\attacker.example/collect",
    "/create\nSet-Cookie: session=stolen",
  ]) {
    assert.equal(cleanHostedUiReturnPath(value, "/create"), "/create");
  }
});
