"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import WelcomePopup from "@/components/WelcomePopup";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Mock signup — wire to the backend when ready.
    setWelcomeOpen(true);
  }

  return (
    <>
      <AuthShell
        title="Create your account"
        subtitle="Start with 1 free image and 1 free song — no card required."
        footer={
          <>
            Already have an account? <Link href="/login" className="souv-auth-link">Log in</Link>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="souv-field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              className="souv-input"
              placeholder="Amelia Hart"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="souv-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="souv-input" placeholder="you@example.com" required />
          </div>
          <div className="souv-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="souv-input" placeholder="At least 8 characters" required />
          </div>
          <Button type="submit" variant="gold" block>
            Create account
          </Button>
        </form>

        <div className="souv-auth-divider">or</div>
        <SocialLoginButtons />
      </AuthShell>

      <WelcomePopup open={welcomeOpen} name={name.split(" ")[0] || "there"} onClose={() => setWelcomeOpen(false)} />
    </>
  );
}
