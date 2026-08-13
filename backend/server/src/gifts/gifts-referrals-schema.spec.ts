import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('gift and referral migration', () => {
  const migration = readFileSync(
    resolve(
      __dirname,
      '../../../database/migrations/016_gifts_and_referrals.sql',
    ),
    'utf8',
  );

  it('makes the gift a delivery-included one-card escrow product', () => {
    expect(migration).toContain("'gift_souvenote_one_card'");
    expect(migration).toContain("'gift'");
    expect(migration).toContain('price_cents');
    expect(migration).toContain('699');
    expect(migration).toContain(
      'printing_included BOOLEAN NOT NULL DEFAULT TRUE',
    );
    expect(migration).toContain(
      'standard_delivery_included BOOLEAN NOT NULL DEFAULT TRUE',
    );
    expect(migration).toContain('card_amount = 1 AND credit_amount = 10');
  });

  it('enforces one referral attribution per referred account', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS referral_invites');
    expect(migration).toContain('referred_user_id UUID UNIQUE');
    expect(migration).toContain('invitee_credit_amount = 8');
    expect(migration).toContain('referrer_credit_amount = 10');
  });
});
