export const PASSWORD_POLICY_DESCRIPTION =
  "Use at least 12 characters with an uppercase letter, lowercase letter, number, and symbol.";

export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return PASSWORD_POLICY_DESCRIPTION;
  if (!/[a-z]/.test(password)) return PASSWORD_POLICY_DESCRIPTION;
  if (!/[A-Z]/.test(password)) return PASSWORD_POLICY_DESCRIPTION;
  if (!/\d/.test(password)) return PASSWORD_POLICY_DESCRIPTION;
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_POLICY_DESCRIPTION;
  return null;
}
