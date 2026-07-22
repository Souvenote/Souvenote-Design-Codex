"use client";

import Link from "next/link";

type AuthGatePromptProps = {
  open: boolean;
  title: string;
  body: string;
  returnTo?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onClose: () => void;
};

function authHref(path: "/login" | "/signup", returnTo = "/create") {
  return `${path}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function AuthGatePrompt({
  open,
  title,
  body,
  returnTo = "/create",
  primaryLabel = "Sign up",
  secondaryLabel = "Log in",
  onClose,
}: AuthGatePromptProps) {
  if (!open) return null;

  return (
    <div className="auth-gate-wrap" role="dialog" aria-modal="true">
      <div className="auth-gate-scrim" onClick={onClose} />
      <div className="auth-gate-card">
        <button type="button" className="auth-gate-close" onClick={onClose} aria-label="Close">x</button>
        <div className="auth-gate-eyebrow">Account required</div>
        <h2 className="auth-gate-title">{title}</h2>
        <p className="auth-gate-body">{body}</p>
        <div className="auth-gate-actions">
          <Link className="bmc-cta" href={authHref("/signup", returnTo)}>{primaryLabel}</Link>
          <Link className="bmc-cta-secondary" href={authHref("/login", returnTo)}>{secondaryLabel}</Link>
        </div>
        <Link className="auth-gate-link" href="/pricing">View card and credit pricing</Link>
      </div>
    </div>
  );
}

