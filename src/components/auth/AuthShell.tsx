import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Centered glass card used by the login & signup routes. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="souv-auth-wrap">
      <div className="souv-auth-card">
        <Link href="/" className="souv-auth-mark" style={{ display: "block" }}>
          Souvenote
        </Link>
        <h1 className="souv-auth-title">{title}</h1>
        <p className="souv-auth-sub">{subtitle}</p>
        {children}
        <div className="souv-auth-foot">{footer}</div>
      </div>
    </div>
  );
}
