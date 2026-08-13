const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const serverRoot = path.resolve(__dirname, '..');
const migrationRoot = path.resolve(serverRoot, '..', 'database', 'migrations');
const seedRoot = path.resolve(serverRoot, '..', 'database', 'seeds');

// Migration 001 received a previously deployed comment-only clarification and
// final newline. These audited hashes cover the original LF/CRLF byte forms so
// the ledger can move once to the canonical checksum without accepting an
// executable SQL change.
const legacyEquivalentChecksums = new Map([
  [
    'migration:001_initial_schema.sql',
    new Set([
      'd30f3b8d35a69e85296d093fc0ffb7e59cfd253d80a995dc75dde96ef19f2af4',
      'ee2208764f763b5577f029c2ce211f0ae04e266831ef45a3be88868794bfd2dd',
    ]),
  ],
]);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .reduce((env, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return env;
      const key = line.slice(0, separatorIndex).trim();
      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^"|"$/g, '');
      env[key] = value;
      return env;
    }, {});
}

function databaseConfig(env) {
  if (env.DATABASE_URL?.trim()) {
    return { connectionString: env.DATABASE_URL.trim() };
  }

  const required = [
    'DATABASE_HOST',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
  ];
  for (const name of required) {
    if (!env[name]?.trim()) {
      throw new Error(`${name} is required to run database migrations.`);
    }
  }

  const config = {
    host: env.DATABASE_HOST.trim(),
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME.trim(),
    user: env.DATABASE_USER.trim(),
    password: env.DATABASE_PASSWORD,
  };

  if (env.DATABASE_SSL_MODE === 'require') {
    config.ssl = { rejectUnauthorized: false };
  } else if (env.DATABASE_SSL_MODE === 'verify-full') {
    if (!env.DATABASE_SSL_CA?.trim()) {
      throw new Error(
        'DATABASE_SSL_CA is required when DATABASE_SSL_MODE=verify-full.',
      );
    }
    config.ssl = {
      ca: fs.readFileSync(env.DATABASE_SSL_CA.trim(), 'utf8'),
      rejectUnauthorized: true,
    };
  }

  return config;
}

function sqlFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((fileName) => /^\d+.*\.sql$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function normalizeTransactionStatements(sql) {
  return sql;
}

function checksum(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function canonicalSql(contents) {
  return contents.replace(/\r\n?/g, '\n');
}

function equivalentSqlChecksums(contents) {
  const canonical = canonicalSql(contents);
  return new Set([
    checksum(canonical),
    checksum(contents),
    checksum(canonical.replace(/\n/g, '\r\n')),
  ]);
}

async function applyVersionedSql(client, kind, directory, fileName) {
  const id = `${kind}:${fileName}`;
  const source = fs.readFileSync(path.join(directory, fileName), 'utf8');
  const digest = checksum(canonicalSql(source));
  const applied = await client.query(
    'SELECT checksum FROM schema_migrations WHERE id = $1;',
    [id],
  );

  if (applied.rowCount) {
    const appliedChecksum = applied.rows[0].checksum;
    const equivalentChecksums = equivalentSqlChecksums(source);
    const auditedLegacyChecksums = legacyEquivalentChecksums.get(id);
    if (
      !equivalentChecksums.has(appliedChecksum) &&
      !auditedLegacyChecksums?.has(appliedChecksum)
    ) {
      throw new Error(
        `${id} changed after it was applied. Add a new numbered SQL file instead.`,
      );
    }
    if (appliedChecksum !== digest) {
      await client.query(
        'UPDATE schema_migrations SET checksum = $2 WHERE id = $1;',
        [id, digest],
      );
      console.log(`Canonicalized checksum for ${id}`);
    }
    console.log(`Already applied ${id}`);
    return;
  }

  await client.query('BEGIN;');
  try {
    await client.query(normalizeTransactionStatements(source));
    await client.query(
      'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2);',
      [id, digest],
    );
    await client.query('COMMIT;');
    console.log(`Applied ${id}`);
  } catch (error) {
    await client.query('ROLLBACK;');
    throw error;
  }
}

async function applyRepeatableSql(client, directory, fileName) {
  const source = fs.readFileSync(path.join(directory, fileName), 'utf8');
  await client.query('BEGIN;');
  try {
    await client.query(normalizeTransactionStatements(source));
    await client.query('COMMIT;');
    console.log(`Applied repeatable seed ${fileName}`);
  } catch (error) {
    await client.query('ROLLBACK;');
    throw error;
  }
}

async function main() {
  const env = {
    ...readEnvFile(path.join(serverRoot, '.env')),
    ...readEnvFile(path.join(serverRoot, '.env.local')),
    ...process.env,
  };
  const pool = new Pool({
    ...databaseConfig(env),
    application_name: 'souvenote-migrations',
    max: 1,
  });
  const client = await pool.connect();

  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext('souvenote:schema-migrations'));",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const fileName of sqlFiles(migrationRoot)) {
      await applyVersionedSql(client, 'migration', migrationRoot, fileName);
    }
    for (const fileName of sqlFiles(seedRoot)) {
      await applyRepeatableSql(client, seedRoot, fileName);
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('souvenote:schema-migrations'));")
      .catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
