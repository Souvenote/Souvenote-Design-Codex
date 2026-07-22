import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(databaseDirectory, 'migrations');
const manifestPath = path.join(migrationsDirectory, 'checksums.sha256');
const migrationFilePattern = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const checksumPattern = /^[0-9a-f]{64}$/;
const advisoryLockName = 'souvenote:schema-migrations';

function fail(message) {
  throw new Error(`Migration safety check failed: ${message}`);
}

async function loadVerifiedMigrations() {
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = new Map();

  for (const [index, rawLine] of manifestText.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([0-9a-f]{64})\s{2}([^/\\]+\.sql)$/u);
    if (!match) {
      fail(`invalid checksum manifest line ${index + 1}`);
    }

    const [, checksum, filename] = match;
    if (manifest.has(filename)) {
      fail(`duplicate checksum manifest entry for ${filename}`);
    }
    manifest.set(filename, checksum);
  }

  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  if (filenames.length === 0) {
    fail('no SQL migration files were found');
  }

  const migrations = [];
  for (const filename of filenames) {
    const fileMatch = filename.match(migrationFilePattern);
    if (!fileMatch) {
      fail(`migration filename does not match NNNN_name.sql: ${filename}`);
    }

    const source = await readFile(path.join(migrationsDirectory, filename));
    const sql = source.toString('utf8');
    if (source.includes(0x0d)) {
      fail(`${filename} must use LF line endings`);
    }
    if (/^\s*\\/mu.test(sql)) {
      fail(`${filename} contains a psql meta-command`);
    }
    if (/^\s*(?:BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;/imu.test(sql)) {
      fail(`${filename} contains transaction control owned by the runner`);
    }
    const checksum = createHash('sha256').update(source).digest('hex');
    const expectedChecksum = manifest.get(filename);

    if (!expectedChecksum) {
      fail(`checksum manifest is missing ${filename}`);
    }
    if (!checksumPattern.test(expectedChecksum) || checksum !== expectedChecksum) {
      fail(`source checksum mismatch for ${filename}`);
    }

    migrations.push({
      version: fileMatch[1],
      name: fileMatch[2],
      filename,
      checksum,
      sql,
    });
  }

  for (const filename of manifest.keys()) {
    if (!filenames.includes(filename)) {
      fail(`checksum manifest references missing migration ${filename}`);
    }
  }

  const versions = new Set();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      fail(`duplicate migration version ${migration.version}`);
    }
    versions.add(migration.version);
  }

  return migrations;
}

async function ensureJournal(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      checksum_sha256 CHAR(64) NOT NULL,
      execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      applied_by NAME NOT NULL DEFAULT current_user,
      CONSTRAINT schema_migrations_checksum_format
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
    )
  `);
}

async function verifyCleanBaselineTarget(client, appliedVersions) {
  if (appliedVersions.size === 0) {
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> 'schema_migrations'
      ORDER BY table_name
      LIMIT 1
    `);

    if (result.rowCount > 0) {
      fail(
        `baseline requires a clean database; found existing public table ${result.rows[0].table_name}`,
      );
    }
  }
}

async function readAndVerifyJournal(client, migrations) {
  const journalResult = await client.query(`
    SELECT version, name, checksum_sha256
    FROM schema_migrations
    ORDER BY version
  `);
  const sourceByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const appliedVersions = new Set();

  for (const row of journalResult.rows) {
    const migration = sourceByVersion.get(row.version);
    if (!migration) {
      fail(`database journal contains unknown migration ${row.version}`);
    }
    if (row.name !== migration.name) {
      fail(`name mismatch for applied migration ${row.version}`);
    }
    if (row.checksum_sha256 !== migration.checksum) {
      fail(`database checksum mismatch for applied migration ${row.version}`);
    }
    appliedVersions.add(row.version);
  }

  return appliedVersions;
}

async function runMigrations(connectionString, migrations, checkOnly) {
  const client = new Client({
    connectionString,
    application_name: checkOnly ? 'souvenote-migration-check' : 'souvenote-migration-runner',
    connectionTimeoutMillis: 5_000,
    query_timeout: 120_000,
  });
  await client.connect();
  let lockHeld = false;

  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [advisoryLockName]);
    lockHeld = true;
    if (checkOnly) {
      const exists = await client.query(`SELECT to_regclass('public.schema_migrations') AS journal`);
      if (!exists.rows[0]?.journal) fail('schema_migrations does not exist');
    } else {
      await ensureJournal(client);
    }

    const appliedVersions = await readAndVerifyJournal(client, migrations);

    await verifyCleanBaselineTarget(client, appliedVersions);

    const pending = migrations.filter((migration) => !appliedVersions.has(migration.version));
    if (checkOnly) {
      if (pending.length > 0) {
        fail(`database has ${pending.length} pending migration(s): ${pending.map((item) => item.filename).join(', ')}`);
      }
      console.log(`database journal verified at ${migrations.length} migration(s)`);
      return;
    }

    for (const migration of migrations) {
      if (!pending.includes(migration)) {
        console.log(`already applied ${migration.filename}`);
        continue;
      }

      const startedAt = process.hrtime.bigint();
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        const elapsedMilliseconds = Number(
          (process.hrtime.bigint() - startedAt) / 1_000_000n,
        );
        await client.query(
          `INSERT INTO schema_migrations
             (version, name, checksum_sha256, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [
            migration.version,
            migration.name,
            migration.checksum,
            elapsedMilliseconds,
          ],
        );
        await client.query('COMMIT');
        console.log(`applied ${migration.filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (lockHeld) {
      await client
        .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [advisoryLockName])
        .catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const allowedArguments = new Set(['--verify-only', '--check']);
  for (const argument of process.argv.slice(2)) {
    if (!allowedArguments.has(argument)) fail(`unsupported argument ${argument}`);
  }
  const migrations = await loadVerifiedMigrations();
  if (process.argv.includes('--verify-only')) {
    console.log(`verified ${migrations.length} migration checksum(s)`);
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    fail('DATABASE_URL is required');
  }

  await runMigrations(connectionString, migrations, process.argv.includes('--check'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown migration failure');
  process.exitCode = 1;
});
