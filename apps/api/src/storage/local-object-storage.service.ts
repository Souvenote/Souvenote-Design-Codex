import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readString, runtimeEnvironment } from '../config/runtime-config';

@Injectable()
export class LocalObjectStorageService {
  private readonly root: string;

  constructor(private readonly configuration: ConfigService) {
    this.root = path.resolve(
      readString(configuration, 'LOCAL_ASSET_STORAGE_DIR') ?? path.join(tmpdir(), 'souvenote-local-assets'),
    );
  }

  async put(storageKey: string, content: Buffer): Promise<void> {
    this.assertLocalMode();
    const target = this.resolve(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await writeFile(target, content, { flag: 'wx' });
    } catch (error: unknown) {
      if (this.errorCode(error) !== 'EEXIST') throw error;
      const existing = await readFile(target);
      if (!existing.equals(content)) {
        throw new ConflictException({
          code: 'STORAGE_KEY_CONFLICT',
          message: 'The local object key already contains different content.',
        });
      }
    }
  }

  async get(storageKey: string): Promise<Buffer> {
    this.assertLocalMode();
    try {
      return await readFile(this.resolve(storageKey));
    } catch (error: unknown) {
      if (this.errorCode(error) === 'ENOENT') throw new NotFoundException('Asset content not found.');
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    this.assertLocalMode();
    await rm(this.resolve(storageKey), { force: true });
  }

  private resolve(storageKey: string): string {
    if (!/^private\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._/-]+$/u.test(storageKey)) {
      throw new Error('Local object storage key is invalid.');
    }
    const target = path.resolve(this.root, ...storageKey.split('/'));
    const prefix = `${this.root}${path.sep}`;
    if (!target.startsWith(prefix)) throw new Error('Local object storage key escaped its root.');
    return target;
  }

  private assertLocalMode(): void {
    const environment = runtimeEnvironment(this.configuration);
    if (environment !== 'development' && environment !== 'test') {
      throw new Error('Local object storage is permitted only in development or test.');
    }
  }

  private errorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
