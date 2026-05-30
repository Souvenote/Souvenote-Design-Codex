"use client";

import { type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Mock auth — wire to the backend when ready.
    router.push("/options");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep creating cards worth keeping."
      footer={
        <>
          New to Souvenote? <Link href="/signup" className="souv-auth-link">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="souv-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="souv-input" placeholder="you@example.com" required />
        </div>
        <div className="souv-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="souv-input" placeholder="••••••••" required />
        </div>
        <div className="souv-auth-row">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <input type="checkbox" /> Remember me
          </label>
          <span className="souv-auth-link">Forgot password?</span>
        </div>
        <Button type="submit" variant="gold" block>
          Log in
        </Button>
      </form>

      <div className="souv-auth-divider">or</div>
      <SocialLoginButtons />
    </AuthShell>
  );
}
