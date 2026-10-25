import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

export type CognitoCodeDelivery = {
  AttributeName?: string;
  DeliveryMedium?: string;
  Destination?: string;
};

export type CognitoSignUpResult = {
  confirmed: boolean;
  codeDelivery?: CognitoCodeDelivery;
};

export type CognitoSession = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
  sub: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
};

export type LocalUser = {
  id: string;
  cognito_user_id?: string | null;
  email: string;
  stripe_customer_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  country?: string | null;
  currency?: string | null;
  language?: string | null;
  marketing_opt_in?: boolean | null;
  preferences?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
};

type CognitoAuthResult = {
  IdToken?: string;
  AccessToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
};

type HostedUiTokenResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type HostedUiState = {
  state: string;
  verifier: string;
  redirectUri: string;
};

type HostedUiContext = {
  nonce: string;
  returnTo?: string;
  authPath?: string;
  provider?: CognitoSocialProvider;
};

export type HostedUiError = {
  code: string;
  message: string;
  provider?: CognitoSocialProvider;
};

export type HostedUiAttempt = {
  authPath: string;
  provider?: CognitoSocialProvider;
};

type CognitoAuthResponse = {
  AuthenticationResult?: CognitoAuthResult;
  ChallengeName?: string;
};

type CognitoSignUpResponse = {
  UserConfirmed?: boolean;
  CodeDeliveryDetails?: CognitoCodeDelivery;
};

type JwtClaims = {
  sub?: string;
  email?: string;
  exp?: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export const AUTH_SESSION_STORAGE_KEY = "souv_cognito_session";
export const AUTH_LOCAL_USER_STORAGE_KEY = "souv_local_user";
export const AUTH_SESSION_UPDATED_EVENT = "souv-auth-session-updated";
const HOSTED_UI_STATE_STORAGE_KEY = "souv_cognito_oauth_state";
const HOSTED_UI_ERROR_PARAM = "souvOauthError";
const HOSTED_UI_PROVIDER_PARAM = "souvOauthProvider";

const EXPIRY_SKEW_MS = 60_000;
let pendingHostedUiError: HostedUiError | null = null;
let pendingHostedUiAttempt: HostedUiAttempt | null = null;
let pendingHostedUiReturnTo: string | null = null;

export type CognitoSocialProvider = "Google" | "Facebook" | "SignInWithApple";

export class CognitoClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CognitoClientError";
  }
}

function toCognitoClientError(error: unknown) {
  if (error instanceof CognitoClientError) return error;

  if (error && typeof error === "object") {
    const record = error as { code?: unknown; name?: unknown; message?: unknown };
    const code = typeof record.code === "string"
      ? record.code
      : typeof record.name === "string"
        ? record.name
        : "CognitoError";
    const message = typeof record.message === "string" ? record.message : "Cognito request failed.";

    return new CognitoClientError(message, code);
  }

  return new CognitoClientError("Cognito request failed.", "CognitoError");
}

function getCognitoConfig(): CognitoConfig {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION?.trim();
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim();

  if (!region || !userPoolId || !clientId) {
    throw new CognitoClientError(
      "Cognito is not configured. Add NEXT_PUBLIC_COGNITO_REGION, NEXT_PUBLIC_COGNITO_USER_POOL_ID, and NEXT_PUBLIC_COGNITO_CLIENT_ID to front end/.env.local.",
      "MissingCognitoConfig",
    );
  }

  return { region, userPoolId, clientId };
}

function getHostedUiConfig() {
  const { clientId } = getCognitoConfig();
  const rawDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.trim();
  const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI?.trim()
    || (typeof window !== "undefined" ? `${window.location.origin}/login` : "");
  const logoutUri = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI?.trim()
    || (typeof window !== "undefined" ? window.location.origin : "");
  const scopes = (process.env.NEXT_PUBLIC_COGNITO_OAUTH_SCOPES || "openid email profile")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!rawDomain || !redirectUri) {
    throw new CognitoClientError(
      "Cognito social sign-in is not configured. Add NEXT_PUBLIC_COGNITO_DOMAIN and NEXT_PUBLIC_COGNITO_REDIRECT_URI to front end/.env.local, then add the same callback URL in Cognito.",
      "MissingHostedUiConfig",
    );
  }

  const domain = /^https?:\/\//i.test(rawDomain)
    ? rawDomain.replace(/\/+$/, "")
    : `https://${rawDomain.replace(/\/+$/, "")}`;

  return {
    clientId,
    domain,
    logoutUri,
    redirectUri,
    scopes: scopes.length ? scopes : ["openid", "email", "profile"],
  };
}

function cognitoEndpoint(region: string) {
  return `https://cognito-idp.${region}.amazonaws.com/`;
}

function getCognitoUserPool() {
  const { userPoolId, clientId } = getCognitoConfig();
  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: clientId,
  });
}

function getCognitoUser(email: string) {
  return new CognitoUser({
    Username: email.trim().toLowerCase(),
    Pool: getCognitoUserPool(),
  });
}

function dispatchAuthUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_UPDATED_EVENT));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier: string) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

function encodeHostedUiContext(context: HostedUiContext) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(context)));
}

function decodeHostedUiContext(value: string | null): HostedUiContext | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Partial<HostedUiContext>;
    return typeof parsed.nonce === "string" ? parsed as HostedUiContext : null;
  } catch {
    return null;
  }
}

function decodeJwtClaims(token: string): JwtClaims {
  const [, payload] = token.split(".");
  if (!payload || typeof window === "undefined") return {};

  try {
    return JSON.parse(decodeBase64Url(payload)) as JwtClaims;
  } catch {
    return {};
  }
}

function buildSession(authResult: CognitoAuthResult, previousRefreshToken?: string): CognitoSession {
  if (!authResult.IdToken || !authResult.AccessToken) {
    throw new CognitoClientError("Cognito did not return a complete session.", "MissingAuthenticationResult");
  }

  const claims = decodeJwtClaims(authResult.IdToken);
  const email = claims.email?.trim();
  const sub = claims.sub?.trim();

  if (!email || !sub) {
    throw new CognitoClientError("Cognito session did not include the expected email and sub claims.", "MissingClaims");
  }

  const expiresAt = claims.exp
    ? claims.exp * 1000
    : Date.now() + ((authResult.ExpiresIn ?? 3600) * 1000);

  return {
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken || previousRefreshToken,
    expiresAt,
    email,
    sub,
    name: claims.name?.trim() || undefined,
    givenName: claims.given_name?.trim() || undefined,
    familyName: claims.family_name?.trim() || undefined,
    picture: claims.picture?.trim() || undefined,
  };
}

function buildSessionFromCognitoUserSession(session: CognitoUserSession): CognitoSession {
  const idToken = session.getIdToken();
  const accessToken = session.getAccessToken();
  const refreshToken = session.getRefreshToken();
  const claims = idToken.decodePayload() as JwtClaims;
  const email = claims.email?.trim();
  const sub = claims.sub?.trim();

  if (!email || !sub) {
    throw new CognitoClientError("Cognito session did not include the expected email and sub claims.", "MissingClaims");
  }

  return {
    idToken: idToken.getJwtToken(),
    accessToken: accessToken.getJwtToken(),
    refreshToken: refreshToken.getToken(),
    expiresAt: idToken.getExpiration() * 1000,
    email,
    sub,
    name: claims.name?.trim() || undefined,
    givenName: claims.given_name?.trim() || undefined,
    familyName: claims.family_name?.trim() || undefined,
    picture: claims.picture?.trim() || undefined,
  };
}

function isExpired(session: CognitoSession) {
  return session.expiresAt <= Date.now() + EXPIRY_SKEW_MS;
}

async function cognitoRequest<T>(target: string, body: Record<string, unknown>): Promise<T> {
  const { region } = getCognitoConfig();
  const response = await fetch(cognitoEndpoint(region), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({})) as {
    __type?: string;
    message?: string;
    Message?: string;
  };

  if (!response.ok) {
    const code = String(payload.__type || response.status).split("#").pop() || "CognitoError";
    throw new CognitoClientError(payload.message || payload.Message || "Cognito request failed.", code);
  }

  return payload as T;
}

export function getStoredCognitoSession(options: { allowExpired?: boolean } = {}): CognitoSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CognitoSession>;
    if (
      typeof parsed.idToken !== "string"
      || typeof parsed.accessToken !== "string"
      || typeof parsed.expiresAt !== "number"
      || typeof parsed.email !== "string"
      || typeof parsed.sub !== "string"
    ) {
      return null;
    }

    const session = parsed as CognitoSession;
    if (!options.allowExpired && isExpired(session)) return null;
    return session;
  } catch {
    return null;
  }
}

function getStoredHostedUiState(): HostedUiState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(HOSTED_UI_STATE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HostedUiState>;
    if (
      typeof parsed.state !== "string"
      || typeof parsed.verifier !== "string"
      || typeof parsed.redirectUri !== "string"
    ) {
      return null;
    }

    return parsed as HostedUiState;
  } catch {
    return null;
  }
}

export function cleanHostedUiReturnPath(value: string | undefined, fallback: string) {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const baseUrl = "https://souvenote.invalid";
    const parsed = new URL(value, baseUrl);
    if (parsed.origin !== baseUrl) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function cleanAuthPath(value: string | undefined) {
  const path = cleanHostedUiReturnPath(value, "/login");
  const pathname = new URL(path, "https://souvenote.invalid").pathname;
  return pathname === "/login" || pathname === "/signup" ? path : "/login";
}

function hostedUiErrorMessage(errorCode: string | undefined) {
  return errorCode === "access_denied"
    ? "Social sign-in was cancelled or denied. Please try again."
    : "Could not finish social sign-in. Please try again.";
}

function cleanProvider(value: string | undefined): CognitoSocialProvider | undefined {
  return value === "Google" || value === "Facebook" || value === "SignInWithApple" ? value : undefined;
}

function hostedUiErrorPath(authPath: string, error: HostedUiError) {
  const url = new URL(cleanAuthPath(authPath), "https://souvenote.invalid");
  url.searchParams.set(HOSTED_UI_ERROR_PARAM, error.code === "access_denied" ? "access_denied" : "failed");
  if (error.provider) url.searchParams.set(HOSTED_UI_PROVIDER_PARAM, error.provider);
  return `${url.pathname}${url.search}${url.hash}`;
}

function clearHostedUiState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HOSTED_UI_STATE_STORAGE_KEY);
}

function storeHostedUiError(error: HostedUiError) {
  pendingHostedUiError = error;
}

function storeHostedUiAttempt(attempt: HostedUiAttempt) {
  pendingHostedUiAttempt = {
    ...attempt,
    authPath: cleanAuthPath(attempt.authPath),
  };
}

function cleanHostedUiCallbackUrl(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  const nextSearch = url.searchParams.toString();
  window.history.replaceState(null, "", `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`);
}

export function storeCognitoSession(session: CognitoSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  dispatchAuthUpdate();
}

export function getStoredLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_LOCAL_USER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalUser>;
    if (typeof parsed.id !== "string" || typeof parsed.email !== "string") return null;
    return parsed as LocalUser;
  } catch {
    return null;
  }
}

export function storeLocalUser(user: LocalUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_LOCAL_USER_STORAGE_KEY, JSON.stringify(user));
  dispatchAuthUpdate();
}

export function clearCognitoAuthState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_LOCAL_USER_STORAGE_KEY);
  pendingHostedUiError = null;
  pendingHostedUiAttempt = null;
  pendingHostedUiReturnTo = null;
  clearHostedUiState();
  dispatchAuthUpdate();
}

export function rememberHostedUiError(error: HostedUiError, authPath?: string) {
  storeHostedUiError(error);
  return authPath ? hostedUiErrorPath(authPath, error) : undefined;
}

export async function startHostedUiSignIn(provider?: CognitoSocialProvider, returnTo = "/create") {
  if (typeof window === "undefined") return;

  const config = getHostedUiConfig();
  const verifier = randomBase64Url(64);
  const nonce = randomBase64Url(32);
  const challenge = await pkceChallenge(verifier);
  const currentAuthPath = `${window.location.pathname}${window.location.search}`;
  const authPath = cleanAuthPath(currentAuthPath.startsWith("/login") || currentAuthPath.startsWith("/signup")
    ? currentAuthPath
    : "/login");

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_LOCAL_USER_STORAGE_KEY);
  pendingHostedUiError = null;
  pendingHostedUiAttempt = null;
  pendingHostedUiReturnTo = null;
  clearHostedUiState();
  dispatchAuthUpdate();

  const state = encodeHostedUiContext({
    nonce,
    returnTo: cleanHostedUiReturnPath(returnTo, "/create"),
    authPath,
    provider,
  });
  window.localStorage.setItem(HOSTED_UI_STATE_STORAGE_KEY, JSON.stringify({
    state: nonce,
    verifier,
    redirectUri: config.redirectUri,
  } satisfies HostedUiState));

  const params = new URLSearchParams({
    client_id: config.clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  if (provider) params.set("identity_provider", provider);
  if (provider === "Google") params.set("prompt", "select_account");

  window.location.assign(`${config.domain}/oauth2/authorize?${params.toString()}`);
}

export async function completeHostedUiSignIn(currentUrl?: string): Promise<CognitoSession | null> {
  if (typeof window === "undefined") return null;

  const url = new URL(currentUrl || window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  const storedState = getStoredHostedUiState();
  const decodedContext = decodeHostedUiContext(state);
  const hostedUiContext = storedState && decodedContext?.nonce === storedState.state ? decodedContext : null;

  if (oauthError) {
    const error = {
      code: oauthError === "access_denied" ? "access_denied" : "HostedUiError",
      message: hostedUiErrorMessage(oauthError),
      provider: hostedUiContext?.provider,
    } satisfies HostedUiError;
    storeHostedUiError(error);
    clearHostedUiState();
    cleanHostedUiCallbackUrl(url);
    const authPath = hostedUiErrorPath(cleanAuthPath(hostedUiContext?.authPath), error);
    if (`${window.location.pathname}${window.location.search}` !== authPath) {
      window.location.replace(authPath);
    }
    throw new CognitoClientError(oauthErrorDescription || oauthError, oauthError);
  }

  if (!code || !state) return null;

  if (!storedState || !hostedUiContext) {
    const error = {
      code: "InvalidHostedUiState",
      message: "The social sign-in response could not be verified. Please try again.",
      provider: undefined,
    } satisfies HostedUiError;
    storeHostedUiError(error);
    clearHostedUiState();
    cleanHostedUiCallbackUrl(url);
    const authPath = hostedUiErrorPath("/login", error);
    if (`${window.location.pathname}${window.location.search}` !== authPath) {
      window.location.replace(authPath);
    }
    throw new CognitoClientError("The social sign-in response could not be verified. Please try again.", "InvalidHostedUiState");
  }

  const config = getHostedUiConfig();
  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: storedState.verifier,
      grant_type: "authorization_code",
      redirect_uri: storedState.redirectUri,
    }),
  });

  const payload = await response.json().catch(() => ({})) as HostedUiTokenResponse;
  if (!response.ok) {
    const message = payload.error_description || payload.error || "Could not finish social sign-in.";
    const error = {
      code: payload.error === "access_denied" ? "access_denied" : "HostedUiTokenError",
      message: hostedUiErrorMessage(payload.error),
      provider: hostedUiContext.provider,
    } satisfies HostedUiError;
    storeHostedUiError(error);
    clearHostedUiState();
    cleanHostedUiCallbackUrl(url);
    const authPath = hostedUiErrorPath(cleanAuthPath(hostedUiContext.authPath), error);
    if (`${window.location.pathname}${window.location.search}` !== authPath) {
      window.location.replace(authPath);
    }
    throw new CognitoClientError(
      message,
      payload.error || "HostedUiTokenError",
    );
  }

  const session = buildSession({
    IdToken: payload.id_token,
    AccessToken: payload.access_token,
    RefreshToken: payload.refresh_token,
    ExpiresIn: payload.expires_in,
  });

  clearHostedUiState();
  cleanHostedUiCallbackUrl(url);
  storeHostedUiAttempt({
    authPath: cleanAuthPath(hostedUiContext.authPath),
    provider: hostedUiContext.provider,
  });
  storeCognitoSession(session);
  pendingHostedUiReturnTo = hostedUiContext.returnTo
    ? cleanHostedUiReturnPath(hostedUiContext.returnTo, "/create")
    : null;
  return session;
}

export function consumeHostedUiError(): HostedUiError | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const errorCode = url.searchParams.get(HOSTED_UI_ERROR_PARAM) || undefined;
  const provider = cleanProvider(url.searchParams.get(HOSTED_UI_PROVIDER_PARAM) || undefined);
  const error = pendingHostedUiError || (errorCode ? {
    code: errorCode === "access_denied" ? "access_denied" : "HostedUiError",
    message: hostedUiErrorMessage(errorCode),
    provider,
  } : null);
  pendingHostedUiError = null;
  if (errorCode) {
    url.searchParams.delete(HOSTED_UI_ERROR_PARAM);
    url.searchParams.delete(HOSTED_UI_PROVIDER_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  return error;
}

export function consumeHostedUiAttempt(): HostedUiAttempt | null {
  const attempt = pendingHostedUiAttempt;
  pendingHostedUiAttempt = null;
  return attempt;
}

export function consumeHostedUiReturnTo() {
  const returnTo = pendingHostedUiReturnTo;
  pendingHostedUiReturnTo = null;
  return returnTo;
}

export function getHostedUiLogoutUrl() {
  const config = getHostedUiConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });

  return `${config.domain}/logout?${params.toString()}`;
}

export async function signUpWithCognito(email: string, password: string): Promise<CognitoSignUpResult> {
  const username = email.trim().toLowerCase();
  const userPool = getCognitoUserPool();

  return new Promise((resolve, reject) => {
    userPool.signUp(
      username,
      password,
      [new CognitoUserAttribute({ Name: "email", Value: username })],
      [],
      (error, result) => {
        if (error || !result) {
          reject(toCognitoClientError(error));
          return;
        }

        resolve({
          confirmed: Boolean(result.userConfirmed),
          codeDelivery: result.codeDeliveryDetails,
        });
      },
    );
  });
}

export async function confirmCognitoSignUp(email: string, confirmationCode: string) {
  const user = getCognitoUser(email);

  await new Promise<void>((resolve, reject) => {
    user.confirmRegistration(confirmationCode.trim(), true, (error) => {
      if (error) {
        reject(toCognitoClientError(error));
        return;
      }

      resolve();
    });
  });
}

export async function signInWithCognito(email: string, password: string): Promise<CognitoSession> {
  const user = getCognitoUser(email);
  const authenticationDetails = new AuthenticationDetails({
    Username: email.trim().toLowerCase(),
    Password: password,
  });

  const session = await new Promise<CognitoSession>((resolve, reject) => {
    user.authenticateUser(authenticationDetails, {
      onSuccess: (cognitoSession) => {
        resolve(buildSessionFromCognitoUserSession(cognitoSession));
      },
      onFailure: (error) => {
        reject(toCognitoClientError(error));
      },
      newPasswordRequired: () => {
        reject(new CognitoClientError("A new password is required for this Cognito user.", "NEW_PASSWORD_REQUIRED"));
      },
      mfaRequired: () => {
        reject(new CognitoClientError("MFA is required for this Cognito user, but this local UI does not support MFA yet.", "SMS_MFA"));
      },
      totpRequired: () => {
        reject(new CognitoClientError("Authenticator-app MFA is required for this Cognito user, but this local UI does not support MFA yet.", "SOFTWARE_TOKEN_MFA"));
      },
      selectMFAType: () => {
        reject(new CognitoClientError("MFA selection is required for this Cognito user, but this local UI does not support MFA yet.", "SELECT_MFA_TYPE"));
      },
    });
  });

  storeCognitoSession(session);
  return session;
}

async function refreshCognitoSession(session: CognitoSession): Promise<CognitoSession | null> {
  if (!session.refreshToken) return null;

  const user = getCognitoUser(session.email);
  const refreshToken = new CognitoRefreshToken({ RefreshToken: session.refreshToken });

  const nextSession = await new Promise<CognitoSession>((resolve, reject) => {
    user.refreshSession(refreshToken, (error, cognitoSession) => {
      if (error) {
        reject(toCognitoClientError(error));
        return;
      }

      resolve(buildSessionFromCognitoUserSession(cognitoSession as CognitoUserSession));
    });
  });

  storeCognitoSession(nextSession);
  return nextSession;
}

export async function getActiveCognitoSession(): Promise<CognitoSession | null> {
  const session = getStoredCognitoSession({ allowExpired: true });
  if (!session) return null;
  if (!isExpired(session)) return session;

  try {
    return await refreshCognitoSession(session);
  } catch {
    clearCognitoAuthState();
    return null;
  }
}
