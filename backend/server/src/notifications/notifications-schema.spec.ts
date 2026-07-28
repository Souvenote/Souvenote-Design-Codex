import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../../database/migrations/011_transactional_notifications.sql',
  ),
  'utf8',
);
const schemaDdl = migration.replace(/^--.*$/gm, '');

describe('transactional notification schema', () => {
  it('stores no duplicated customer email, address, or message content', () => {
    expect(schemaDdl).not.toMatch(
      /\b(email|recipient_address|sender_address|creative_brief|card_content|message_content|raw_payload)\b/i,
    );
    expect(migration).toContain('template_data JSONB');
  });

  it('deduplicates notification intents and provider callback events', () => {
    expect(migration).toMatch(/idempotency_key VARCHAR\(255\) NOT NULL UNIQUE/);
    expect(migration).toMatch(/event_id VARCHAR\(100\) PRIMARY KEY/);
  });

  it('has explicit ambiguous-delivery and bounded lifecycle states', () => {
    expect(migration).toContain("'delivery_unknown'");
    expect(migration).toContain("'order_confirmation'");
    expect(migration).toContain("'order_shipped'");
    expect(migration).toContain("'order_delivered'");
  });
});
