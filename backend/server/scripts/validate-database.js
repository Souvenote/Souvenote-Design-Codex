const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const serverRoot = path.resolve(__dirname, '..');
const databaseRoot = path.resolve(serverRoot, '..', 'database');
const migrationDirectory = path.join(databaseRoot, 'migrations');
const seedDirectory = path.join(databaseRoot, 'seeds');

const expectedTables = [
  'asset_moderation_jobs',
  'assets',
  'audit_logs',
  'card_drafts',
  'credit_ledger',
  'credit_pack_purchases',
  'fulfillment_jobs',
  'generation_jobs',
  'notification_delivery_events',
  'notification_outbox',
  'orders',
  'payments',
  'pricing_catalog',
  'public_card_links',
  'stripe_webhook_events',
  'uploads',
  'user_payment_methods',
  'users',
];

function sqlFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((fileName) => /^\d{3}_.+\.sql$/.test(fileName))
    .sort();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for database validation.');
  }
  if (process.env.DATABASE_VALIDATION_ALLOW_FRESH_DATABASE !== 'true') {
    throw new Error(
      'Set DATABASE_VALIDATION_ALLOW_FRESH_DATABASE=true only for a disposable, empty validation database.',
    );
  }

  const migrationFiles = sqlFiles(migrationDirectory);
  const seedFiles = sqlFiles(seedDirectory);
  if (migrationFiles.length < 12) {
    throw new Error(
      `Expected migrations through at least 012, found ${migrationFiles.length}.`,
    );
  }
  migrationFiles.forEach((fileName, index) => {
    const expectedPrefix = `${String(index + 1).padStart(3, '0')}_`;
    if (!fileName.startsWith(expectedPrefix)) {
      throw new Error(
        `Expected a continuous migration sequence at ${expectedPrefix}, found ${fileName}.`,
      );
    }
  });
  if (seedFiles.length === 0) {
    throw new Error('No database seed files were found.');
  }

  const client = new Client({ connectionString: databaseUrl });
  let transactionStarted = false;

  try {
    await client.connect();

    const existingResult = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    if (existingResult.rows.length > 0) {
      throw new Error(
        'Database validation refused to run because the public schema is not empty.',
      );
    }

    await client.query('BEGIN');
    transactionStarted = true;

    for (const fileName of migrationFiles) {
      const sql = fs.readFileSync(
        path.join(migrationDirectory, fileName),
        'utf8',
      );
      await client.query(sql);
    }

    for (const fileName of seedFiles) {
      const sql = fs.readFileSync(path.join(seedDirectory, fileName), 'utf8');
      await client.query(sql);
    }

    const tableResult = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const actualTables = new Set(
      tableResult.rows.map((row) => String(row.table_name)),
    );
    const missingTables = expectedTables.filter(
      (tableName) => !actualTables.has(tableName),
    );
    if (missingTables.length > 0) {
      throw new Error(
        `Database validation is missing expected tables: ${missingTables.join(', ')}.`,
      );
    }

    const pricingResult = await client.query(
      'SELECT COUNT(*)::integer AS count FROM pricing_catalog',
    );
    const pricingCount = Number(pricingResult.rows[0]?.count ?? 0);
    if (pricingCount < 1) {
      throw new Error('The pricing catalog seed did not create any offers.');
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(
      `Database validation passed: ${migrationFiles.length} migrations, ${seedFiles.length} seed file, ${expectedTables.length} required tables, and ${pricingCount} pricing offers.`,
    );
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('Database validation failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
