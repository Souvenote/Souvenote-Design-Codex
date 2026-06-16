const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const serverRoot = path.resolve(__dirname, '..');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .reduce((env, line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '');
      env[key] = value;
      return env;
    }, {});
}

async function main() {
  const env = {
    ...readEnvFile(path.join(serverRoot, '.env')),
    ...readEnvFile(path.join(serverRoot, '.env.local')),
    ...process.env,
  };

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to apply the Phase 1 migration.');
  }

  const migrationPath = path.resolve(
    serverRoot,
    '..',
    'database',
    'migrations',
    '002_phase1_mock_backend.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    await pool.query(sql);
    console.log('Phase 1 migration applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Phase 1 migration failed.');
  console.error(error.message);
  process.exit(1);
});
