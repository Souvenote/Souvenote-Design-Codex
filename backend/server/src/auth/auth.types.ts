import type { Request } from 'express';

export type CognitoJwtClaims = {
  sub: string;
  email: string;
  iss: string;
  aud: string;
  token_use: string;
  exp: number;
  iat?: number;
  nbf?: number;
  [key: string]: unknown;
};

export type AuthenticatedRequest = Request & {
  cognitoUser: CognitoJwtClaims;
};
