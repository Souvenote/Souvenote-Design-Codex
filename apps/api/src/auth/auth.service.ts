import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenClaims } from './auth.types';
import { AuthRepository, type UserRow } from './auth.repository';

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthday?: string;
  language?: string;
  marketingOptIn?: boolean;
  preferences?: Record<string, unknown>;
};

function claimString(claims: AccessTokenClaims, key: string): string {
  const value = claims[key];
  return typeof value === 'string' ? value.trim() : '';
}

function cleanText(value: string | undefined, maximum: number): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function cleanBirthday(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('Birthday must use YYYY-MM-DD format.');
  }
  return trimmed;
}

function namesFromClaims(claims: AccessTokenClaims): { firstName: string | null; lastName: string | null } {
  const givenName = claimString(claims, 'given_name');
  const familyName = claimString(claims, 'family_name');
  if (givenName || familyName) return { firstName: givenName || null, lastName: familyName || null };

  const pieces = claimString(claims, 'name').split(/\s+/).filter(Boolean);
  return { firstName: pieces[0] ?? null, lastName: pieces.slice(1).join(' ') || null };
}

function validatePreferences(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, 'utf8') > 16_384) {
    throw new BadRequestException('Preferences exceed the 16 KiB limit.');
  }
  const visit = (candidate: unknown, depth: number): void => {
    if (depth > 6) throw new BadRequestException('Preferences are nested too deeply.');
    if (!candidate || typeof candidate !== 'object') return;
    const entries = Object.entries(candidate as Record<string, unknown>);
    if (entries.length > 100) throw new BadRequestException('Preferences contain too many fields.');
    for (const [key, child] of entries) {
      if (key.length > 120) throw new BadRequestException('A preferences field name is too long.');
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return value;
}

@Injectable()
export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async provisionPrincipal(claims: AccessTokenClaims) {
    const subject = claims.sub.trim();
    const email = claims.email.trim().toLowerCase();
    if (!subject || !email) throw new UnauthorizedException('Access token is missing user identity claims.');
    const names = namesFromClaims(claims);
    return this.repository.provisionIdentity({
      provider: claims.iss === 'souvenote-local' ? 'local' : 'cognito',
      issuer: claims.iss,
      subject,
      clientId: claims.client_id,
      email,
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      ...names,
    });
  }

  async getMe(userId: string) {
    return { user: this.toUser(await this.repository.findUser(userId)) };
  }

  async updateMe(userId: string, input: UpdateUserProfileInput) {
    const user = await this.repository.updateProfile(userId, {
      firstName: cleanText(input.firstName, 120),
      lastName: cleanText(input.lastName, 120),
      phone: cleanText(input.phone, 40),
      birthday: cleanBirthday(input.birthday),
      language: cleanText(input.language, 32) ?? undefined,
      marketingOptIn: input.marketingOptIn,
      preferences: validatePreferences(input.preferences),
    });
    return { user: this.toUser(user) };
  }

  private toUser(user: UserRow) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      birthday: user.birthday instanceof Date ? user.birthday.toISOString().slice(0, 10) : user.birthday,
      country: user.country,
      currency: user.currency,
      language: user.language,
      marketingOptIn: user.marketing_opt_in,
      preferences: user.preferences ?? {},
      provisionedAt: user.provisioned_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
