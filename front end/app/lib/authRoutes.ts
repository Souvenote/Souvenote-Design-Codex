export type PostSignupReason = "created" | "exists";

export function loginHrefAfterSignup(
  email: string,
  returnTo: string,
  reason: PostSignupReason,
) {
  const params = new URLSearchParams({ returnTo });
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail) params.set("email", normalizedEmail);

  if (reason === "created") {
    return `/first-login?${params.toString()}`;
  }

  params.set("signup", "exists");
  return `/login?${params.toString()}`;
}
