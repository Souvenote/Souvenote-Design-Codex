import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreditsService } from '../credits/credits.service';
import { DatabaseService } from '../database/database.service';
import type { CognitoJwtClaims } from './auth.types';

type LocalUserRow = {
  id: string;
  cognito_user_id: string | null;
  email: string;
  stripe_customer_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birthday: string | Date | null;
  country: string;
  currency: string;
  language: string;
  marketing_opt_in: boolean;
  preferences: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

type PaymentMethodRow = {
  id: string;
  user_id: string;
  stripe_payment_method_id: string | null;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  billing_name: string | null;
  billing_postal_code: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
};

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthday?: string;
  country?: string;
  currency?: string;
  language?: string;
  marketingOptIn?: boolean;
  preferences?: Record<string, unknown>;
};

export type SavePaymentMethodInput = {
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  billingName?: string;
  billingPostalCode?: string;
  stripePaymentMethodId?: string;
  isDefault?: boolean;
};

const STARTER_CREDITS = 2;
const USER_SELECT = `
  id,
  cognito_user_id,
  email,
  stripe_customer_id,
  first_name,
  last_name,
  phone,
  birthday,
  country,
  currency,
  language,
  marketing_opt_in,
  preferences,
  created_at,
  updated_at
`;
const PAYMENT_SELECT = `
  id,
  user_id,
  stripe_payment_method_id,
  brand,
  last4,
  exp_month,
  exp_year,
  billing_name,
  billing_postal_code,
  is_default,
  created_at,
  updated_at
`;

function claimString(claims: CognitoJwtClaims, key: string) {
  const value = claims[key];
  return typeof value === 'string' ? value.trim() : '';
}

function splitDisplayName(name: string) {
  const pieces = name.split(/\s+/).filter(Boolean);
  return {
    firstName: pieces[0] || null,
    lastName: pieces.slice(1).join(' ') || null,
  };
}

function nameFromClaims(claims: CognitoJwtClaims) {
  const givenName = claimString(claims, 'given_name');
  const familyName = claimString(claims, 'family_name');
  const displayName = claimString(claims, 'name');

  if (givenName || familyName) {
    return {
      firstName: givenName || null,
      lastName: familyName || null,
    };
  }

  return splitDisplayName(displayName);
}

function parseJsonClaim(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function claimArray(claims: CognitoJwtClaims, key: string): unknown[] {
  const value = claims[key];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseJsonClaim(value);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function federatedProviderName(claims: CognitoJwtClaims) {
  for (const identity of claimArray(claims, 'identities')) {
    if (!isRecord(identity)) continue;
    const providerName = identity.providerName ?? identity.ProviderName;
    if (typeof providerName === 'string' && providerName.trim()) {
      return providerName.trim();
    }
  }

  const username = claimString(claims, 'cognito:username');
  const providerMatch = username.match(/^([^_]+)_/);
  return providerMatch?.[1] || '';
}

function isFederatedCognitoUser(claims: CognitoJwtClaims) {
  return Boolean(federatedProviderName(claims));
}

function socialEmailConflictMessage(claims: CognitoJwtClaims) {
  const provider = federatedProviderName(claims) || 'social provider';
  return `This email is already registered with another sign-in method. Log in with the original email and password account instead of ${provider}.`;
}

function cleanText(value: string | undefined, maxLength: number) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanBirthday(value: string | undefined, fallback: string | Date | null) {
  if (value === undefined) return serializeDate(fallback);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('Birthday must use YYYY-MM-DD format.');
  }

  return trimmed;
}

function serializeDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeCountry(value: string | undefined, fallback: string) {
  const next = value?.trim().toUpperCase();
  return next || fallback || 'CA';
}

function normalizeCurrency(value: string | undefined, fallback: string) {
  const next = value?.trim().toUpperCase();
  return next || fallback || 'CAD';
}

function normalizeLanguage(value: string | undefined, fallback: string) {
  const next = value?.trim();
  return next ? next.slice(0, 32) : fallback || 'English';
}

function normalizeLast4(value: string | undefined) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 4) {
    throw new BadRequestException('Payment method last4 must include exactly four digits.');
  }

  return digits;
}

function normalizeExpiryMonth(value: number | undefined, fallback?: number) {
  const month = Number(value ?? fallback);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new BadRequestException('Payment method expiration month must be between 1 and 12.');
  }

  return month;
}

function normalizeExpiryYear(value: number | undefined, fallback?: number) {
  const rawYear = Number(value ?? fallback);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    throw new BadRequestException('Payment method expiration year is not valid.');
  }

  return year;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly creditsService: CreditsService,
  ) {}

  async syncCognitoUser(claims: CognitoJwtClaims) {
    const cognitoSub = claims.sub.trim();
    const email = claims.email.trim().toLowerCase();

    if (!cognitoSub || !email) {
      throw new UnauthorizedException('Cognito token is missing user identity claims.');
    }

    const user = await this.findOrCreateLocalUser(cognitoSub, email, claims);
    const starterCredits = await this.creditsService.grantOnce(
      user.id,
      STARTER_CREDITS,
      'cognito_signup',
      `starter-credits-${cognitoSub}`,
      'signup_grant',
    );

    return {
      user,
      paymentMethods: await this.listPaymentMethods(user.id),
      starterCredits: {
        granted: starterCredits.granted,
        balance: starterCredits.balance,
      },
    };
  }

  async updateUserProfile(userId: string, input: UpdateUserProfileInput) {
    const current = await this.getUserById(userId);
    const updated = await this.databaseService.query<LocalUserRow>(
      `
        UPDATE users
        SET
          first_name = $2,
          last_name = $3,
          phone = $4,
          birthday = $5::date,
          country = $6,
          currency = $7,
          language = $8,
          marketing_opt_in = $9,
          preferences = $10::jsonb,
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING ${USER_SELECT};
      `,
      [
        userId,
        cleanText(input.firstName, 120) ?? current.first_name,
        cleanText(input.lastName, 120) ?? current.last_name,
        cleanText(input.phone, 40),
        cleanBirthday(input.birthday, current.birthday),
        normalizeCountry(input.country, current.country),
        normalizeCurrency(input.currency, current.currency),
        normalizeLanguage(input.language, current.language),
        input.marketingOptIn ?? current.marketing_opt_in,
        JSON.stringify(input.preferences ?? current.preferences ?? {}),
      ],
    );

    return updated.rows[0];
  }

  async listPaymentMethods(userId: string) {
    const result = await this.databaseService.query<PaymentMethodRow>(
      `
        SELECT ${PAYMENT_SELECT}
        FROM user_payment_methods
        WHERE user_id = $1
          AND deleted_at IS NULL
        ORDER BY is_default DESC, updated_at DESC;
      `,
      [userId],
    );

    return result.rows;
  }

  async createPaymentMethod(userId: string, input: SavePaymentMethodInput) {
    const existing = await this.listPaymentMethods(userId);
    const shouldSetDefault = input.isDefault ?? existing.length === 0;
    const method = {
      brand: cleanText(input.brand, 40) || 'Card',
      last4: normalizeLast4(input.last4),
      expMonth: normalizeExpiryMonth(input.expMonth),
      expYear: normalizeExpiryYear(input.expYear),
      billingName: cleanText(input.billingName, 255),
      billingPostalCode: cleanText(input.billingPostalCode, 40),
      stripePaymentMethodId: cleanText(input.stripePaymentMethodId, 255),
    };

    if (shouldSetDefault) {
      await this.clearDefaultPaymentMethod(userId);
    }

    const inserted = await this.databaseService.query<PaymentMethodRow>(
      `
        INSERT INTO user_payment_methods (
          user_id,
          stripe_payment_method_id,
          brand,
          last4,
          exp_month,
          exp_year,
          billing_name,
          billing_postal_code,
          is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${PAYMENT_SELECT};
      `,
      [
        userId,
        method.stripePaymentMethodId,
        method.brand,
        method.last4,
        method.expMonth,
        method.expYear,
        method.billingName,
        method.billingPostalCode,
        shouldSetDefault,
      ],
    );

    return inserted.rows[0];
  }

  async updatePaymentMethod(userId: string, paymentMethodId: string, input: SavePaymentMethodInput) {
    const current = await this.getPaymentMethod(userId, paymentMethodId);
    const shouldSetDefault = input.isDefault ?? current.is_default;

    if (shouldSetDefault && !current.is_default) {
      await this.clearDefaultPaymentMethod(userId);
    }

    const updated = await this.databaseService.query<PaymentMethodRow>(
      `
        UPDATE user_payment_methods
        SET
          stripe_payment_method_id = $3,
          brand = $4,
          last4 = $5,
          exp_month = $6,
          exp_year = $7,
          billing_name = $8,
          billing_postal_code = $9,
          is_default = $10,
          updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL
        RETURNING ${PAYMENT_SELECT};
      `,
      [
        paymentMethodId,
        userId,
        cleanText(input.stripePaymentMethodId, 255) ?? current.stripe_payment_method_id,
        cleanText(input.brand, 40) ?? current.brand,
        input.last4 === undefined ? current.last4 : normalizeLast4(input.last4),
        normalizeExpiryMonth(input.expMonth, current.exp_month),
        normalizeExpiryYear(input.expYear, current.exp_year),
        input.billingName === undefined ? current.billing_name : cleanText(input.billingName, 255),
        input.billingPostalCode === undefined ? current.billing_postal_code : cleanText(input.billingPostalCode, 40),
        shouldSetDefault,
      ],
    );

    return updated.rows[0];
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const current = await this.getPaymentMethod(userId, paymentMethodId);
    await this.databaseService.query(
      `
        UPDATE user_payment_methods
        SET deleted_at = NOW(),
            is_default = FALSE,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $2;
      `,
      [paymentMethodId, userId],
    );

    if (current.is_default) {
      await this.databaseService.query(
        `
          UPDATE user_payment_methods
          SET is_default = TRUE,
              updated_at = NOW()
          WHERE id = (
            SELECT id
            FROM user_payment_methods
            WHERE user_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT 1
          );
        `,
        [userId],
      );
    }

    return { deleted: true };
  }

  private async findOrCreateLocalUser(cognitoSub: string, email: string, claims: CognitoJwtClaims) {
    const claimName = nameFromClaims(claims);
    const isFederatedUser = isFederatedCognitoUser(claims);
    const bySub = await this.databaseService.query<LocalUserRow>(
      `
        SELECT ${USER_SELECT}
        FROM users
        WHERE cognito_user_id = $1
          AND deleted_at IS NULL;
      `,
      [cognitoSub],
    );

    if (bySub.rows[0]) {
      return this.updateUserEmail(bySub.rows[0].id, cognitoSub, email, claimName);
    }

    const byEmail = await this.databaseService.query<LocalUserRow>(
      `
        SELECT ${USER_SELECT}
        FROM users
        WHERE lower(email) = $1
          AND deleted_at IS NULL;
      `,
      [email],
    );

    const existing = byEmail.rows[0];
    if (existing) {
      if (isFederatedUser && existing.cognito_user_id !== cognitoSub) {
        throw new ConflictException(socialEmailConflictMessage(claims));
      }

      if (existing.cognito_user_id && existing.cognito_user_id !== cognitoSub) {
        throw new ConflictException('A local user with this email is already linked to another Cognito user.');
      }

      return this.updateUserEmail(existing.id, cognitoSub, email, claimName);
    }

    const inserted = await this.databaseService.query<LocalUserRow>(
      `
        INSERT INTO users (cognito_user_id, email, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING ${USER_SELECT};
      `,
      [cognitoSub, email, claimName.firstName, claimName.lastName],
    );

    return inserted.rows[0];
  }

  private async updateUserEmail(
    userId: string,
    cognitoSub: string,
    email: string,
    claimName: { firstName: string | null; lastName: string | null },
  ) {
    const updated = await this.databaseService.query<LocalUserRow>(
      `
        UPDATE users
        SET cognito_user_id = $2,
            email = $3,
            first_name = COALESCE(first_name, $4),
            last_name = COALESCE(last_name, $5),
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT};
      `,
      [userId, cognitoSub, email, claimName.firstName, claimName.lastName],
    );

    return updated.rows[0];
  }

  private async getUserById(userId: string) {
    const result = await this.databaseService.query<LocalUserRow>(
      `
        SELECT ${USER_SELECT}
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL;
      `,
      [userId],
    );

    const user = result.rows[0];
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async getPaymentMethod(userId: string, paymentMethodId: string) {
    const result = await this.databaseService.query<PaymentMethodRow>(
      `
        SELECT ${PAYMENT_SELECT}
        FROM user_payment_methods
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL;
      `,
      [paymentMethodId, userId],
    );

    const paymentMethod = result.rows[0];
    if (!paymentMethod) throw new NotFoundException('Payment method not found.');
    return paymentMethod;
  }

  private async clearDefaultPaymentMethod(userId: string) {
    await this.databaseService.query(
      `
        UPDATE user_payment_methods
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE user_id = $1
          AND deleted_at IS NULL;
      `,
      [userId],
    );
  }
}
