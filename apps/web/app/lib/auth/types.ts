export type AuthMode = 'cognito' | 'local';

export type CognitoSocialProvider = 'Google' | 'Facebook' | 'SignInWithApple';

export type AuthIntent = 'login' | 'signup';

export type AuthTransaction = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  authPath: string;
  provider?: CognitoSocialProvider;
  createdAt: number;
};

export type AccessSession = {
  accessToken: string;
  csrfToken: string;
  expiresAt: number;
  provider: AuthMode;
};

export type RefreshSession = {
  refreshToken: string;
  provider: 'cognito';
};

export type CognitoTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type LocalAccessClaims = {
  sub: string;
  email: string;
  iss: 'souvenote-local';
  client_id: string;
  token_use: 'access';
  scope: string;
  iat: number;
  exp: number;
};
