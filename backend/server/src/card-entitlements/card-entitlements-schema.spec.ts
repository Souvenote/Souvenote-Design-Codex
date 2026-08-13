import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../../database/migrations/013_card_entitlement_ledger.sql',
  ),
  'utf8',
);

describe('card-entitlement ledger schema', () => {
  it('keeps balances owner-scoped and append-only', () => {
    expect(migration).toMatch(
      /user_id UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/,
    );
    expect(migration).toMatch(/amount INTEGER NOT NULL/);
    expect(migration).toMatch(/CHECK \(amount <> 0\)/);
    expect(migration).not.toMatch(/\bUPDATE card_entitlement_ledger\b/i);
  });

  it('deduplicates every trusted grant or deduction', () => {
    expect(migration).toMatch(/idempotency_key VARCHAR\(255\) NOT NULL UNIQUE/);
    expect(migration).toContain('idx_card_entitlement_ledger_user_created');
  });

  it('stores no recipient, card content, or payment payload', () => {
    expect(migration).not.toMatch(
      /\b(recipient_address|sender_address|card_content|payment_payload)\b/i,
    );
  });
});
