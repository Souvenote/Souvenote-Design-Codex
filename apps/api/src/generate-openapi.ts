import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { configureApi } from './api-configuration';
import { AppModule } from './app.module';

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObject(child)]),
  );
}

async function main(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_MODE = 'local';
  process.env.LOCAL_AUTH_SECRET ??= 'openapi-local-auth-secret-32-characters-minimum';
  process.env.LOCAL_AUTH_CLIENT_ID ??= 'souvenote-local-web';
  process.env.COGNITO_REQUIRED_SCOPES ??= 'souvenote/customer';
  process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@127.0.0.1:1/openapi';
  const output = path.resolve(process.env.OPENAPI_OUTPUT ?? '../../packages/contracts/openapi.json');
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  try {
    const document = configureApi(app);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(sortObject(document), null, 2)}\n`, 'utf8');
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'OpenAPI generation failed.'}\n`);
  process.exitCode = 1;
});
