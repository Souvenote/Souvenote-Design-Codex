export const AUTH_ACCESS_COOKIE = 'souvenote_access';
export const AUTH_REFRESH_COOKIE = 'souvenote_refresh';
export const AUTH_TRANSACTION_COOKIE = 'souvenote_auth_tx';
export const AUTH_CSRF_HEADER = 'x-souvenote-csrf';

export const PRODUCTION_AUTH_ACCESS_COOKIE = '__Host-souvenote_access';
export const PRODUCTION_AUTH_REFRESH_COOKIE = '__Host-souvenote_refresh';
export const PRODUCTION_AUTH_TRANSACTION_COOKIE = '__Host-souvenote_auth_tx';

export const LOCAL_TOKEN_PREFIX = 'souvenote-local';
export const DEFAULT_AUTH_SCOPES = ['openid', 'email', 'profile', 'souvenote:customer'];

export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60;
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const TRANSACTION_COOKIE_MAX_AGE_SECONDS = 10 * 60;
export const TOKEN_REFRESH_SKEW_SECONDS = 60;
export const MAX_PROXY_BODY_BYTES = 10 * 1024 * 1024;
