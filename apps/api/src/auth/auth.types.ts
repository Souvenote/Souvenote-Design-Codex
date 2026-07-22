import type { Request } from 'express';

export type AccessTokenClaims = {
  sub: string;
  email: string;
  iss: string;
  client_id: string;
  token_use: string;
  scope: string;
  exp: number;
  iat: number;
  nbf?: number;
  [key: string]: unknown;
};

export type AuthenticatedRequest = Request & {
  accessTokenClaims: AccessTokenClaims;
  user: {
    id: string;
    cognitoSub: string;
    email: string;
  };
  requestId: string;
};
