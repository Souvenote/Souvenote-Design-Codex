"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";
import {
  CognitoClientError,
  consumeHostedUiError,
  getConfiguredSocialProviders,
  type CognitoSocialProvider,
  type HostedUiError,
} from "../lib/cognitoAuth";
import {
  PASSWORD_POLICY_DESCRIPTION,
  passwordPolicyError,
} from "../lib/passwordPolicy";
import { loginHrefAfterSignup } from "../lib/authRoutes";

// Auth.tsx - Souvenote auth surface.
// 7 state components: signup, login, welcome (post-signup modal), forgot, reset, verify, recover.

type AuthIconName =
  | "check"
  | "arrow"
  | "back"
  | "eye"
  | "eye-off"
  | "mail"
  | "lock"
  | "shield"
  | "gift"
  | "note"
  | "image"
  | "alert"
  | "clock"
  | "play"
  | "star";

type AuthIconProps = {
  name: AuthIconName;
  w?: number;
};

type AuthCheckboxProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  children: React.ReactNode;
};

type SocialButtonsProps = {
  providers: CognitoSocialProvider[];
  verb?: string;
  onProvider?: (provider: CognitoSocialProvider) => void;
};

type WelcomeModalProps = {
  stepDob?: boolean;
};

type VerifyVariant = "success" | "expired";

type VerifyViewProps = {
  variant?: VerifyVariant;
};

type AuthRouteState = "signup" | "login" | "first-login" | "welcome" | "forgot" | "reset" | "verify" | "verify-expired" | "recover";
type AuthState = AuthRouteState | "welcome-dob";

type AuthStateOption = {
  id: AuthRouteState;
  label: string;
};

type AuthAppProps = {
  initialState?: AuthState;
};

// ============================================================
// SHARED ICONS
// ============================================================
function AuthIcon({ name, w = 18 }: AuthIconProps) {
  const props: React.SVGProps<SVGSVGElement> = { width: w, height: w, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'check':   return <svg {...props}><path d="M5 12.5l4 4 10-10" /></svg>;
    case 'arrow':   return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'back':    return <svg {...props}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
    case 'eye':     return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'eye-off': return <svg {...props}><path d="M3 3l18 18" /><path d="M10.6 6.2C11.05 6.07 11.52 6 12 6c6.5 0 10 7 10 7-.55 1.1-1.4 2.32-2.5 3.4M14 14a3 3 0 1 1-4-4" /><path d="M6.6 6.6C4.4 8.05 3 10 2 12c0 0 3.5 7 10 7 1.9 0 3.55-.55 5-1.45" /></svg>;
    case 'mail':    return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 7 9-7" /></svg>;
    case 'lock':    return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="1.6" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>;
    case 'shield':  return <svg {...props}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M8.5 12l2.5 2.5 5-5" /></svg>;
    case 'gift':    return <svg {...props}><rect x="3.5" y="8" width="17" height="5" /><path d="M5 13v8h14v-8" /><path d="M12 8v13" /><path d="M12 8s-3-4.5-5-3 .8 4 5 3zM12 8s3-4.5 5-3-.8 4-5 3z" /></svg>;
    case 'note':    return <svg {...props}><path d="M9 17V5l11-2v12" /><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="15.5" r="2.5" fill="currentColor" stroke="none" /></svg>;
    case 'image':   return <svg {...props}><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M3.5 17 L9 12 L13 15.5 L17 11 L20.5 14.5" /></svg>;
    case 'alert':   return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>;
    case 'clock':   return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case 'play':    return <svg {...props} fill="currentColor" stroke="none"><path d="M7 5v14l12-7z" /></svg>;
    case 'star':    return <svg viewBox="0 0 24 24" width={w} height={w} fill="currentColor" aria-hidden="true"><path d="M12 2.4l2.85 6.18 6.78.74-5.07 4.6 1.46 6.68L12 17.27 5.98 20.6l1.46-6.68-5.07-4.6 6.78-.74L12 2.4z" /></svg>;
    default:        return null;
  }
}

// Brand glyphs (kept as exact path data — match real provider marks)
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.65 4.65-6.1 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.31 14.69l6.57 4.82C14.69 16.1 19 13 24 13c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.69 8.34 6.31 14.69z"/>
      <path fill="#4CAF50" d="M24 44c5.16 0 9.86-1.98 13.4-5.2l-6.18-5.23C29.21 35.1 26.74 36 24 36c-5.16 0-9.6-3.33-11.28-7.95l-6.52 5.02C9.6 39.55 16.24 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.79 2.24-2.23 4.16-4.08 5.57l6.18 5.23C40.99 35.78 44 30.32 44 24c0-1.34-.14-2.65-.4-3.5z"/>
    </svg>
  );
}
function AppleA() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M16.36 12.55c-.02-2.36 1.92-3.5 2-3.55-1.09-1.6-2.79-1.82-3.4-1.85-1.45-.15-2.83.85-3.57.85-.74 0-1.87-.83-3.07-.8-1.58.02-3.04.92-3.85 2.34-1.64 2.85-.42 7.06 1.18 9.37.78 1.13 1.71 2.4 2.93 2.35 1.18-.05 1.62-.76 3.05-.76 1.42 0 1.82.76 3.07.74 1.27-.02 2.07-1.15 2.85-2.28.9-1.31 1.27-2.58 1.29-2.65-.03-.01-2.46-.94-2.48-3.76zM14.38 5.55c.66-.8 1.1-1.91.98-3.02-.95.04-2.1.63-2.78 1.43-.61.7-1.15 1.84-1 2.93 1.06.08 2.14-.54 2.8-1.34z"/>
    </svg>
  );
}
function FacebookF() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#1877F2" d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.5V9.7c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5H15c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/>
    </svg>
  );
}

// ============================================================
// SHELL
// ============================================================
function AuthTopbar() {
  // No back chrome for the post-signup modal state (modal is over Page 2)
  return (
    <header className="auth-topbar">
      <Link className="auth-topbar-logo" href="/" aria-label="Souvenote">
        <span className="auth-topbar-logo-mark" role="img" aria-label="Souvenote">
          <img className="auth-topbar-logo-img" src="/assets/WordmarkLobster.png" alt="Souvenote" width={1445} height={334} />
          <span className="auth-topbar-logo-sheen" aria-hidden="true" />
        </span>
      </Link>
      <Link className="auth-topbar-back" href="/">
        <AuthIcon name="back" w={13} /> Back to site
      </Link>
    </header>
  );
}

function AuthFooter() {
  return (
    <footer className="auth-foot">
      <span>© 2026 Souvenote · Made with care in Canada</span>
      <span className="auth-foot-links">
        <Link href="/legal/privacy-policy">Privacy</Link>
        <Link href="/legal/terms-of-service">Terms</Link>
        <Link href="/faq">Help</Link>
      </span>
    </footer>
  );
}

function AuthCheckbox({ checked, onChange, children }: AuthCheckboxProps) {
  return (
    <label className={`auth-check ${checked ? 'is-checked' : ''}`}>
      <span className="auth-check-box"><AuthIcon name="check" w={12} /></span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange && onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

const CONFIGURED_SOCIAL_PROVIDERS = getConfiguredSocialProviders();

function SocialButtons({ providers, verb = 'Continue', onProvider }: SocialButtonsProps) {
  return (
    <div className="auth-socials">
      {providers.includes("Google") && (
        <button type="button" className="auth-social" onClick={() => onProvider?.("Google")}>
          <span className="auth-social-icon"><GoogleG /></span>
          <span>{verb} with Google</span>
        </button>
      )}
      {providers.includes("SignInWithApple") && (
        <button type="button" className="auth-social" onClick={() => onProvider?.("SignInWithApple")}>
          <span className="auth-social-icon" style={{ color: 'var(--platinum-hi)' }}><AppleA /></span>
          <span>{verb} with Apple</span>
        </button>
      )}
      {providers.includes("Facebook") && (
        <button type="button" className="auth-social" onClick={() => onProvider?.("Facebook")}>
          <span className="auth-social-icon"><FacebookF /></span>
          <span>{verb} with Facebook</span>
        </button>
      )}
    </div>
  );
}

// Password strength estimator (simple, visual only)
function strength(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/\d/.test(p) && /[a-z]/i.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
function strengthLabel(s: number) {
  return ['Too short', 'Weak', 'Okay', 'Strong', 'Solid'][s] || 'Strong';
}

function friendlyAuthError(error: unknown) {
  if (error instanceof CognitoClientError) {
    if (error.code === "UserNotConfirmedException") return "Confirm your email before logging in.";
    if (error.code === "NotAuthorizedException") return "That email and password did not match.";
    if (error.code === "UsernameExistsException") return "An account already exists for that email. Try logging in.";
    if (error.code === "InvalidPasswordException") return error.message;
    if (error.code === "CodeMismatchException") return "That confirmation code did not match.";
    if (error.code === "ExpiredCodeException") return "That confirmation code expired. Request a new code and try again.";
  }

  return error instanceof Error ? error.message : "Authentication failed. Please try again.";
}

function passwordResetRequestError(error: unknown) {
  if (
    error instanceof CognitoClientError &&
    ["UserNotFoundException", "InvalidParameterException"].includes(error.code)
  ) {
    return null;
  }
  if (
    error instanceof CognitoClientError &&
    ["LimitExceededException", "TooManyRequestsException"].includes(error.code)
  ) {
    return "Too many reset attempts were made. Wait a while before trying again.";
  }
  return "We couldn't send a reset code right now. Please try again.";
}

function socialProviderLabel(provider?: CognitoSocialProvider) {
  if (provider === "Google") return "Google";
  if (provider === "Facebook") return "Facebook";
  if (provider === "SignInWithApple") return "Apple";
  return "that social provider";
}

function socialAuthFailureMessage(error: HostedUiError) {
  const provider = socialProviderLabel(error.provider);
  if (error.code === "access_denied") {
    return `${provider} sign-in was cancelled or blocked. Choose a ${provider} account that can sign in, then try again below, or use email and password.`;
  }

  if (error.code === "HostedUiAccountSyncError") {
    const detail = error.message ? ` ${error.message}` : "";
    return `${provider} signed in, but Souvenote could not connect that login to your account.${detail} You can try again below.`;
  }

  return `${provider} could not finish sign-in. If that email is not connected to ${provider}, choose a different ${provider} account or use email and password. You can try again below.`;
}

function cleanReturnTo(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function signupLoginMessage(reason: string | null) {
  if (reason === "exists") return "That email already has an account. Log in with your email and password instead.";
  return null;
}

function loginStatusMessage(
  signupReason: string | null,
  resetReason: string | null,
) {
  if (resetReason === "success") {
    return "Password reset complete. Log in with your new password.";
  }
  return signupLoginMessage(signupReason);
}

// ============================================================
// SIGN UP (00a)
// ============================================================
function SignUpView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, confirmSignup, startSocialSignIn, error: authContextError } = useAuth();
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const [confirmationCode, setConfirmationCode] = React.useState('');
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);
  const [authMessage, setAuthMessage] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const s = strength(pw);
  const returnTo = cleanReturnTo(searchParams.get("returnTo"), "/welcome");

  React.useEffect(() => {
    const hostedUiError = consumeHostedUiError();
    if (!hostedUiError) return;
    setSubmitting(false);
    setAuthMessage(null);
    setAuthError(socialAuthFailureMessage(hostedUiError));
  }, [authContextError]);

  const handleSignup = React.useCallback(async () => {
    setAuthError(null);
    setAuthMessage(null);

    if (!email.trim() || !pw) {
      setAuthError("Enter an email and password to create your account.");
      return;
    }

    if (pw !== pw2) {
      setAuthError("Passwords don't match yet.");
      return;
    }

    const policyError = passwordPolicyError(pw);
    if (policyError) {
      setAuthError(policyError);
      return;
    }

    if (!terms) {
      setAuthError("Accept the terms before creating your account.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signup(email, pw);
      if (result.needsConfirmation) {
        setNeedsConfirmation(true);
        setAuthMessage("Check your email for a Cognito confirmation code, then enter it below.");
        return;
      }

      router.push(loginHrefAfterSignup(email, returnTo, "created"));
    } catch (error) {
      if (error instanceof CognitoClientError && error.code === "UsernameExistsException") {
        router.push(loginHrefAfterSignup(email, returnTo, "exists"));
        return;
      }
      setAuthError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }, [email, pw, pw2, returnTo, router, signup, terms]);

  const handleConfirm = React.useCallback(async () => {
    setAuthError(null);
    setAuthMessage(null);

    if (!confirmationCode.trim()) {
      setAuthError("Enter the confirmation code from your email.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmSignup(email, confirmationCode, pw);
      router.push(loginHrefAfterSignup(email, returnTo, "created"));
    } catch (error) {
      if (error instanceof CognitoClientError && error.code === "UsernameExistsException") {
        router.push(loginHrefAfterSignup(email, returnTo, "exists"));
        return;
      }
      setAuthError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }, [confirmSignup, confirmationCode, email, pw, returnTo, router]);

  const handleSocialSignUp = React.useCallback(async (provider: CognitoSocialProvider) => {
    setAuthError(null);
    setAuthMessage(null);
    setSubmitting(true);
    try {
      await startSocialSignIn(provider, returnTo);
    } catch (error) {
      setSubmitting(false);
      setAuthError(friendlyAuthError(error));
    }
  }, [returnTo, startSocialSignIn]);

  return (
    <div className="auth-stage">
      <div className={`auth-card auth-card-wide auth-card-signup ${CONFIGURED_SOCIAL_PROVIDERS.length ? "" : "auth-card-signup-single"}`}>
        <div className="auth-authflow">
          <div className="auth-authflow-intro">
          <div className="auth-eyebrow">Sign Up · Welcome</div>
          <h1 className="auth-title auth-title-hero auth-title-claim">
            Sign up and claim <span className="text-metallic-rose-gold">2 free credits</span>
          </h1>
          </div>

          <div className={`auth-method-grid ${CONFIGURED_SOCIAL_PROVIDERS.length ? "" : "auth-method-grid-single"}`}>
          {CONFIGURED_SOCIAL_PROVIDERS.length > 0 && (
            <section className="auth-method-panel">
              <div className="auth-method-kicker">Fastest</div>
              <h2 className="auth-method-title">Sign up with social</h2>
              <p className="auth-method-sub">Use an existing account and we&apos;ll open your welcome credits right away.</p>
              <SocialButtons providers={CONFIGURED_SOCIAL_PROVIDERS} verb="Continue" onProvider={handleSocialSignUp} />
            </section>
          )}

          <section className="auth-method-panel auth-method-panel-email">
            <div className="auth-method-kicker">Email</div>
            <h2 className="auth-method-title">Sign up with email</h2>
            <p className="auth-method-sub">Create your account with an email and password. You can add profile preferences after logging in.</p>

          <div className="auth-email-fields auth-email-fields-signup">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input className="auth-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <input className="auth-input" type={show ? 'text' : 'password'} placeholder="At least 12 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="auth-input-reveal" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                <AuthIcon name={show ? 'eye-off' : 'eye'} />
              </button>
            </div>
            <div className={`auth-meter s${s}`}><span /><span /><span /><span /></div>
            <div className="auth-meter-label">
              <span>Password strength</span>
              <span style={{ color: s >= 3 ? 'var(--gold)' : s === 0 ? 'var(--rose-gold)' : 'var(--text-muted)' }}>{strengthLabel(s)}</span>
            </div>
            <p className="auth-hint">{PASSWORD_POLICY_DESCRIPTION}</p>
          </div>

          <div className="auth-field">
            <label className="auth-label">Confirm password</label>
            <input className={`auth-input ${pw2 && pw2 !== pw ? 'is-error' : ''}`} type={show ? 'text' : 'password'} placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            {pw2 && pw2 !== pw && <p className="auth-hint is-error">Passwords don't match yet.</p>}
          </div>

          <AuthCheckbox checked={terms} onChange={setTerms}>
            I agree to the <Link href="/legal/terms-of-service">Terms of Service</Link> and the <Link href="/legal/privacy-policy">Privacy Policy</Link>.
          </AuthCheckbox>

          {authMessage && <p className="auth-hint" style={{ color: 'var(--gold)' }}>{authMessage}</p>}
          {authError && <p className="auth-hint is-error">{authError}</p>}

          {needsConfirmation && (
            <div className="auth-field">
              <label className="auth-label">Confirmation code</label>
              <input className="auth-input" placeholder="123456" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} />
            </div>
          )}

          {needsConfirmation ? (
            <button type="button" className="auth-submit" onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Confirming..." : "Confirm & Go to Login"} <AuthIcon name="arrow" w={16} />
            </button>
          ) : (
            <button type="button" className="auth-submit" onClick={handleSignup} disabled={submitting}>
              {submitting ? "Creating..." : "Create Account"} <AuthIcon name="arrow" w={16} />
            </button>
          )}

          <div className="auth-cardfoot">
            Already have an account?{' '}
            <Link href="/login">Log in →</Link>
          </div>
          </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOG IN + FIRST LOGIN (00b)
// ============================================================
type LoginViewProps = {
  firstTime?: boolean;
};

function LoginView({ firstTime = false }: LoginViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, confirmSignup, startSocialSignIn, error: authContextError } = useAuth();
  const isFirstTime = firstTime || searchParams.get("signup") === "created";
  const socialProviders = isFirstTime ? [] : CONFIGURED_SOCIAL_PROVIDERS;
  const [email, setEmail] = React.useState(() => searchParams.get("email") || '');
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [confirmationCode, setConfirmationCode] = React.useState('');
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);
  const [authMessage, setAuthMessage] = React.useState<string | null>(() =>
    isFirstTime
      ? "Your account is ready. Log in once to continue."
      : loginStatusMessage(searchParams.get("signup"), searchParams.get("reset")),
  );
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const returnTo = cleanReturnTo(searchParams.get("returnTo"), isFirstTime ? "/welcome" : "/create");

  React.useEffect(() => {
    const hostedUiError = consumeHostedUiError();
    if (!hostedUiError) return;
    setSubmitting(false);
    setAuthMessage(null);
    setAuthError(socialAuthFailureMessage(hostedUiError));
  }, [authContextError]);

  const handleLogin = React.useCallback(async () => {
    setAuthError(null);
    setAuthMessage(null);

    if (!email.trim() || !pw) {
      setAuthError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email, pw);
      router.push(returnTo);
    } catch (error) {
      if (error instanceof CognitoClientError && error.code === "UserNotConfirmedException") {
        setNeedsConfirmation(true);
      }
      setAuthError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }, [email, login, pw, returnTo, router]);

  const handleConfirm = React.useCallback(async () => {
    setAuthError(null);
    setAuthMessage(null);

    if (!confirmationCode.trim()) {
      setAuthError("Enter the confirmation code from your email.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmSignup(email, confirmationCode, pw);
      await login(email, pw);
      router.push(returnTo);
    } catch (error) {
      setAuthError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }, [confirmSignup, confirmationCode, email, login, pw, returnTo, router]);

  const handleSocialLogin = React.useCallback(async (provider: CognitoSocialProvider) => {
    setAuthError(null);
    setAuthMessage(null);
    setSubmitting(true);
    try {
      await startSocialSignIn(provider, returnTo);
    } catch (error) {
      setSubmitting(false);
      setAuthError(friendlyAuthError(error));
    }
  }, [returnTo, startSocialSignIn]);

  return (
    <div className="auth-stage">
      <div className="auth-card auth-card-login">
          <div className="auth-authflow">
            <div className="auth-authflow-intro">
        <div className="auth-eyebrow">{isFirstTime ? "Account created" : "Welcome back"}</div>
        <h1 className="auth-title">
          {isFirstTime ? (
            <>
              Your first Souvenote{' '}
              <span className="souv-hero-italic text-metallic-rose-gold">starts here</span>
            </>
          ) : (
            <>
              Pick up where you{' '}
              <span className="souv-hero-italic text-metallic-rose-gold">left off</span>
            </>
          )}
        </h1>
        <p className="auth-sub">
          {isFirstTime
            ? "Log in once with the email and password you just created to unlock your 2 welcome credits."
            : "Log in securely to continue to your saved cards, songs, and account."}
        </p>
            </div>

          <div className={`auth-method-grid ${socialProviders.length ? "" : "auth-method-grid-single"}`}>
        {socialProviders.length > 0 && (
          <section className="auth-method-panel">
            <div className="auth-method-kicker">Social</div>
            <h2 className="auth-method-title">Log in with social</h2>
            <p className="auth-method-sub">Continue with the same provider you used to create your Souvenote account.</p>
            <SocialButtons providers={socialProviders} verb="Continue" onProvider={handleSocialLogin} />
          </section>
        )}

        <section className="auth-method-panel auth-method-panel-email">
          <div className="auth-method-kicker">{isFirstTime ? "First sign-in" : "Email"}</div>
          <h2 className="auth-method-title">{isFirstTime ? "Continue with email" : "Log in with email"}</h2>
          <p className="auth-method-sub">
            {isFirstTime
              ? "Use the email and password you just chose. We’ll take you straight to your welcome."
              : "Use your email and password to get back to your saved cards and songs."}
          </p>

        <div className="auth-email-fields">
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input className="auth-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="auth-field">
          <div className="auth-row-between">
            <label className="auth-label" style={{ margin: 0 }}>Password</label>
            <Link className="auth-link" href="/forgot">Forgot?</Link>
          </div>
          <div className="auth-input-wrap">
            <input className="auth-input" type={show ? 'text' : 'password'} placeholder="Your password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="auth-input-reveal" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              <AuthIcon name={show ? 'eye-off' : 'eye'} />
            </button>
          </div>
        </div>

        {authMessage && <p className="auth-hint" style={{ color: 'var(--gold)' }}>{authMessage}</p>}
        {authError && <p className="auth-hint is-error">{authError}</p>}

        {needsConfirmation && (
          <div className="auth-field">
            <label className="auth-label">Confirmation code</label>
            <input className="auth-input" placeholder="123456" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} />
          </div>
        )}

        {needsConfirmation ? (
          <button type="button" className="auth-submit" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Confirming..." : "Confirm & Log In"} <AuthIcon name="arrow" w={16} />
          </button>
        ) : (
          <button type="button" className="auth-submit" onClick={handleLogin} disabled={submitting}>
            {submitting ? "Logging in..." : isFirstTime ? "Continue" : "Log In"} <AuthIcon name="arrow" w={16} />
          </button>
        )}

        <div className="auth-cardfoot">
          {isFirstTime ? (
            <>Already had a Souvenote account? <Link href="/login">Use the returning login →</Link></>
          ) : (
            <>Don&apos;t have an account? <Link href="/signup">Sign up →</Link></>
          )}
        </div>
        </div>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WELCOME MODAL (00c)
// ============================================================
function WelcomeModal({ stepDob = false }: WelcomeModalProps) {
  const step = stepDob ? 'dob' : 'welcome';
  const [dob, setDob] = React.useState('');

  return (
    <div className="auth-stage auth-stage-modal-only">
      <div className="auth-modal-wrap auth-modal-wrap-welcome">
        <div className="auth-modal-scrim" />
        <div className="auth-modal auth-welcome-modal">
          <div className="auth-modal-confetti">
            <i /><i /><i /><i /><i /><i /><i />
          </div>

          {step === 'welcome' ? (
            <>
              <span className="auth-modal-pill">
                <AuthIcon name="gift" w={14} /> <b>2 CREDITS</b> in your account.
              </span>
              <h2 className="auth-modal-title auth-welcome-title">
                <span>Welcome to</span>
                <img src="/assets/WordmarkLobster.png" alt="Souvenote" width={1445} height={334} />
              </h2>
              <p className="auth-modal-sub auth-welcome-sub">
                To get started, select <span className="auth-shimmer-gold">Personalize a Template</span> to see what's possible or <span className="auth-shimmer-rose">Build My Card</span> if you already have a design idea.
              </p>
              <div className="auth-welcome-options" aria-label="Create options">
                <Link className="opt-tile opt-tile-gold auth-welcome-option" href="/create/personalize-a-template">
                  <span className="opt-tile-surface" aria-hidden="true"></span>
                  <span className="opt-tile-grain" aria-hidden="true"></span>
                  <span className="opt-tile-badge">
                    <AuthIcon name="star" w={12} />
                    <em>Most popular</em>
                  </span>
                  <span className="opt-tile-body">
                    <span className="opt-tile-title">Personalize a Template</span>
                    <span className="opt-tile-sub">Need inspiration? Personalize one of our pre-built cards like Horoscope or Comic cards!</span>
                  </span>
                  <span className="opt-tile-music" aria-hidden="true">
                    <AuthIcon name="note" w={18} />
                  </span>
                </Link>
                <Link className="opt-tile opt-tile-rose auth-welcome-option" href="/create/build-my-card">
                  <span className="opt-tile-surface" aria-hidden="true"></span>
                  <span className="opt-tile-grain" aria-hidden="true"></span>
                  <span className="opt-tile-body">
                    <span className="opt-tile-title">Build My Card</span>
                    <span className="opt-tile-sub">Have your own idea? Answer a few questions and watch your card come to life.</span>
                  </span>
                  <span className="opt-tile-music" aria-hidden="true">
                    <AuthIcon name="note" w={18} />
                  </span>
                </Link>
              </div>
            </>
          ) : (
            <div className="auth-modal-dob">
              <h2 className="auth-modal-title" style={{ textAlign: 'center' }}>
                One more thing,{' '}
                <span className="souv-hero-italic text-metallic-rose-gold">your birthday</span>
              </h2>
              <p className="auth-modal-sub" style={{ textAlign: 'center' }}>
                Add your birthday so your loved ones are reminded when it&apos;s your turn to get a gift.
              </p>
              <div className="auth-field">
                <label className="auth-label">
                  Birthday <span style={{ color: 'var(--rose-gold)' }}>*</span>
                </label>
                <input className="auth-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="auth-modal-acts">
                <button type="button" className="auth-submit-secondary">Skip for now</button>
                <button type="button" className="auth-submit">Save &amp; Continue <AuthIcon name="arrow" w={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FORGOT PASSWORD (00d)
// ============================================================
function ForgotView() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const handleSend = React.useCallback(async () => {
    setAuthError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setAuthError("Enter the email address for your account.");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setSent(true);
    } catch (error) {
      const safeError = passwordResetRequestError(error);
      if (safeError) setAuthError(safeError);
      else setSent(true);
    } finally {
      setSubmitting(false);
    }
  }, [email, requestPasswordReset]);

  const continueToReset = React.useCallback(() => {
    const params = new URLSearchParams({ email: email.trim().toLowerCase() });
    router.push(`/reset?${params.toString()}`);
  }, [email, router]);

  return (
    <div className="auth-stage auth-stage-secondary">
      <div className="auth-card auth-card-secondary">
        <div className="auth-eyebrow">Account · Reset</div>
        <h1 className="auth-title">
          Reset your{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">password</span>
        </h1>
        <p className="auth-sub">
          Enter your account email and we&apos;ll ask Cognito to send a one-time
          verification code.
        </p>

        {sent ? (
          <>
            <span className="auth-sent-pill">
              <AuthIcon name="check" w={12} /> Check your inbox
            </span>
            <p className="auth-hint" style={{ marginBottom: 22 }}>
              If an eligible account exists for that email, a password-reset
              code is on its way. Enter that code on the next screen.
            </p>
            {authError && <p className="auth-hint is-error">{authError}</p>}
            <button
              type="button"
              className="auth-submit"
              onClick={continueToReset}
            >
              Enter reset code <AuthIcon name="arrow" w={16} />
            </button>
            <button
              type="button"
              className="auth-submit-secondary"
              onClick={handleSend}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Resend code"}
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setSent(false);
                setAuthError(null);
              }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <div className="auth-field">
              <label className="auth-label">Account email</label>
              <input className="auth-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {authError && <p className="auth-hint is-error">{authError}</p>}
            <button
              type="button"
              className="auth-submit"
              onClick={handleSend}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send reset code"} <AuthIcon name="mail" w={16} />
            </button>
          </>
        )}

        <div className="auth-cardfoot">
          Remembered it?{' '}
          <Link href="/login">Back to log in →</Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESET PASSWORD (00e)
// ============================================================
function ResetView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmPasswordReset } = useAuth();
  const [email, setEmail] = React.useState(() => searchParams.get("email") || '');
  const [code, setCode] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const s = strength(pw);
  const match = pw && pw2 && pw === pw2;

  const handleReset = React.useCallback(async () => {
    setAuthError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setAuthError("Enter the email address for your account.");
      return;
    }
    if (!code.trim()) {
      setAuthError("Enter the reset code from your email.");
      return;
    }
    const policyError = passwordPolicyError(pw);
    if (policyError) {
      setAuthError(policyError);
      return;
    }
    if (pw !== pw2) {
      setAuthError("Passwords don't match yet.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(normalizedEmail, code, pw);
      const params = new URLSearchParams({
        email: normalizedEmail,
        reset: "success",
      });
      router.push(`/login?${params.toString()}`);
    } catch (error) {
      setAuthError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }, [code, confirmPasswordReset, email, pw, pw2, router]);

  return (
    <div className="auth-stage auth-stage-secondary">
      <div className="auth-card auth-card-secondary auth-card-reset">
        <div className="auth-eyebrow">Account · Reset</div>
        <h1 className="auth-title">
          Set a{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">new password</span>
        </h1>
        <p className="auth-sub">
          Enter the verification code Cognito emailed you, then choose a new
          password. You&apos;ll return to login after the reset succeeds.
        </p>

        <div className="auth-field">
          <label className="auth-label">Account email</label>
          <input
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Reset code</label>
          <input
            className="auth-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">New password</label>
          <div className="auth-input-wrap">
            <input className="auth-input" type={show ? 'text' : 'password'} placeholder="At least 12 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="auth-input-reveal" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              <AuthIcon name={show ? 'eye-off' : 'eye'} />
            </button>
          </div>
          <div className={`auth-meter s${s}`}><span /><span /><span /><span /></div>
          <div className="auth-meter-label">
            <span>Strength</span>
            <span style={{ color: s >= 3 ? 'var(--gold)' : s === 0 ? 'var(--rose-gold)' : 'var(--text-muted)' }}>{strengthLabel(s)}</span>
          </div>
          <p className="auth-hint">{PASSWORD_POLICY_DESCRIPTION}</p>
        </div>

        <div className="auth-field">
          <label className="auth-label">Confirm password</label>
          <input
            className={`auth-input ${pw2 && pw2 !== pw ? 'is-error' : ''}`}
            type={show ? 'text' : 'password'}
            placeholder="Type it again"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          {pw2 && pw2 !== pw && <p className="auth-hint is-error">Passwords don't match yet.</p>}
          {match && <p className="auth-hint" style={{ color: 'var(--gold)' }}>Matched.</p>}
        </div>

        {authError && <p className="auth-hint is-error">{authError}</p>}

        <button
          type="button"
          className="auth-submit"
          onClick={handleReset}
          disabled={submitting}
        >
          {submitting ? "Resetting..." : "Set new password"} <AuthIcon name="arrow" w={16} />
        </button>

        <p className="auth-hint" style={{ marginTop: 18, textAlign: 'center' }}>
          Need another code? <Link href="/forgot">Request a new one.</Link>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// EMAIL VERIFICATION (00f)
// ============================================================
function VerifyView({ variant = 'success' }: VerifyViewProps) {
  return (
    <div className="auth-stage auth-stage-secondary">
      <div className="auth-card auth-card-secondary auth-status-center">
        {variant === 'success' && (
          <>
            <span className="auth-status-icon">
              <AuthIcon name="check" w={36} />
            </span>
            <div className="auth-eyebrow" style={{ justifyContent: 'center' }}>Verified · Welcome aboard</div>
            <h1 className="auth-title">
              Email{' '}
              <span className="souv-hero-italic text-metallic-rose-gold">verified</span>
            </h1>
            <p className="auth-sub">
              Your inbox checks out. Card-pack purchases are unlocked and your two starter credits
              are ready to use.
            </p>
            <Link href="/create" className="auth-submit" style={{ textDecoration: 'none' }}>
              Continue to Souvenote <AuthIcon name="arrow" w={16} />
            </Link>
          </>
        )}
        {variant === 'expired' && (
          <>
            <span className="auth-status-icon is-rose">
              <AuthIcon name="alert" w={36} />
            </span>
            <div className="auth-eyebrow is-rose" style={{ justifyContent: 'center' }}>Expired link</div>
            <h1 className="auth-title">
              That link{' '}
              <span className="souv-hero-italic text-metallic-rose-gold">timed out</span>
            </h1>
            <p className="auth-sub">
              Verification links last twenty-four hours. We can send you a fresh one with the same email
              and a new token.
            </p>
            <button type="button" className="auth-submit">
              Resend verification email <AuthIcon name="mail" w={16} />
            </button>
            <p className="auth-hint" style={{ marginTop: 14 }}>Up to three sends per day.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ACCOUNT RECOVERY (00g)
// ============================================================
function RecoverView() {
  return (
    <div className="auth-stage auth-stage-secondary">
      <div className="auth-card auth-card-secondary auth-status-center">
        <span className="auth-status-icon is-rose">
          <AuthIcon name="shield" w={36} />
        </span>
        <div className="auth-eyebrow is-rose" style={{ justifyContent: 'center' }}>Account recovery</div>
        <h1 className="auth-title">
          Recovery is not yet{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">self-service</span>
        </h1>
        <p className="auth-sub">
          Souvenote&apos;s retention schedule includes a 30-day recovery grace period after an
          account-deletion request, but the verified recovery workflow is still being prepared for
          production. Contact support from the email address on your account for help.
        </p>
        <a
          href="mailto:support@souvenote.com?subject=Souvenote%20account%20recovery"
          className="auth-submit"
          style={{ textDecoration: 'none' }}
        >
          Contact support <AuthIcon name="mail" w={16} />
        </a>
        <Link href="/login" className="auth-link" style={{ marginTop: 14 }}>
          Return to login
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// TOP-LEVEL
// ============================================================
const AUTH_STATES: AuthStateOption[] = [
  { id: 'signup',   label: 'Sign Up' },
  { id: 'login',    label: 'Log In' },
  { id: 'first-login', label: 'First Login' },
  { id: 'welcome',  label: 'Welcome' },
  { id: 'forgot',   label: 'Forgot' },
  { id: 'reset',    label: 'Reset' },
  { id: 'verify',   label: 'Verify' },
  { id: 'verify-expired', label: 'Verify · Expired' },
  { id: 'recover',  label: 'Recover' },
];

function isAuthRouteState(value: string | undefined): value is AuthRouteState {
  return Boolean(value && AUTH_STATES.some((state) => state.id === value));
}

function AuthApp({ initialState = 'signup' }: AuthAppProps) {
  const [state, setState] = React.useState<AuthState>(initialState);
  const isModalOnly = state === 'welcome' || state === 'welcome-dob';
  const isSignupPage = state === 'signup';
  const isLoginPage = state === 'login' || state === 'first-login';
  const isSecondaryPage =
    state === 'forgot' ||
    state === 'reset' ||
    state === 'verify' ||
    state === 'verify-expired' ||
    state === 'recover';

  React.useEffect(() => {
    function syncToggle() {
      document.querySelectorAll<HTMLAnchorElement>('#auth-state-toggle a[data-s]').forEach(a => {
        a.classList.toggle('is-active', a.dataset.s === state);
      });
    }
    syncToggle();
    function handler(ev: MouseEvent) {
      if (!(ev.target instanceof Element)) return;
      const a = ev.target.closest<HTMLAnchorElement>('#auth-state-toggle a[data-s]');
      if (!a) return;
      const nextState = a.dataset.s;
      if (!isAuthRouteState(nextState)) return;
      ev.preventDefault();
      setState(nextState);
      window.location.hash = nextState;
    }
    function hashHandler() {
      const h = (window.location.hash || '').replace('#', '');
      if (isAuthRouteState(h)) setState(h);
    }
    document.addEventListener('click', handler);
    window.addEventListener('hashchange', hashHandler);
    return () => {
      document.removeEventListener('click', handler);
      window.removeEventListener('hashchange', hashHandler);
    };
  }, [state]);

  return (
    <div className={`auth-page ${isModalOnly ? 'auth-page-modal-only' : ''} ${isSignupPage ? 'auth-page-signup' : ''} ${isLoginPage ? 'auth-page-login' : ''} ${isSecondaryPage ? 'auth-page-secondary' : ''}`}>
      {!isModalOnly && <AuthTopbar />}

      {state === 'signup'         && <SignUpView />}
      {state === 'login'          && <LoginView />}
      {state === 'first-login'    && <LoginView firstTime />}
      {state === 'welcome'        && <WelcomeModal stepDob={false} />}
      {state === 'welcome-dob'    && <WelcomeModal stepDob={true} />}
      {state === 'forgot'         && <ForgotView />}
      {state === 'reset'          && <ResetView />}
      {state === 'verify'         && <VerifyView variant="success" />}
      {state === 'verify-expired' && <VerifyView variant="expired" />}
      {state === 'recover'        && <RecoverView />}

      {!isModalOnly && <AuthFooter />}
    </div>
  );
}

export { AuthApp, AUTH_STATES };
