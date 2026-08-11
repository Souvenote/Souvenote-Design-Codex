import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readString, runtimeEnvironment } from '../config/runtime-config';
import type { GenerationAction, GenerationFailureCategory } from './generation-policy';

export type GeneratedAssetType = 'image' | 'song' | 'message';

export type DeterministicAssetOutput = {
  assetType: GeneratedAssetType;
  mediaType: string;
  content: Buffer;
  widthPixels: number | null;
  heightPixels: number | null;
  durationSeconds: number | null;
  moderationStatus: 'passed' | 'not_required';
};

export class DeterministicProviderError extends Error {
  constructor(
    readonly category: GenerationFailureCategory,
    readonly assetType: GeneratedAssetType,
  ) {
    super(`Deterministic ${assetType} provider failed with ${category}.`);
  }
}

@Injectable()
export class DeterministicGenerationProvider {
  constructor(private readonly configuration: ConfigService) {}

  assertEnabled(action: GenerationAction): void {
    const environment = runtimeEnvironment(this.configuration);
    if (environment !== 'development' && environment !== 'test') this.throwDisabled();

    const requiredModes = new Set<string>(['IMAGE_PROVIDER_MODE', 'TEXT_PROVIDER_MODE']);
    if (action === 'initial_image_song' || action === 'regenerate_song') requiredModes.add('MUSIC_PROVIDER_MODE');
    if (action === 'inside_message') {
      requiredModes.clear();
      requiredModes.add('TEXT_PROVIDER_MODE');
    }
    for (const key of requiredModes) {
      if (readString(this.configuration, key)?.toLowerCase() !== 'mock') this.throwDisabled();
    }
  }

  assetTypes(action: GenerationAction): GeneratedAssetType[] {
    switch (action) {
      case 'initial_image':
        return ['image', 'message'];
      case 'initial_image_song':
        return ['image', 'song', 'message'];
      case 'regenerate_image':
        return ['image'];
      case 'regenerate_song':
        return ['song'];
      case 'inside_message':
        return ['message'];
    }
  }

  generate(
    assetType: GeneratedAssetType,
    seed: string,
    creativeBrief: Record<string, unknown>,
  ): DeterministicAssetOutput {
    const scenario = typeof creativeBrief.mockScenario === 'string' ? creativeBrief.mockScenario : '';
    const failure = this.failureFor(scenario, assetType);
    if (failure) throw new DeterministicProviderError(failure, assetType);

    if (assetType === 'image') {
      return {
        assetType,
        mediaType: 'image/svg+xml',
        content: Buffer.from(this.image(seed), 'utf8'),
        widthPixels: 1000,
        heightPixels: 1400,
        durationSeconds: null,
        moderationStatus: 'passed',
      };
    }
    if (assetType === 'song') {
      return {
        assetType,
        mediaType: 'audio/wav',
        content: this.song(seed),
        widthPixels: null,
        heightPixels: null,
        durationSeconds: 30,
        moderationStatus: 'passed',
      };
    }
    const messages = [
      'A little moment, made just for you. Happy celebrating!\n',
      'Here is to the memories behind us and the bright moments still ahead.\n',
      'Made with care for someone who makes every day feel more meaningful.\n',
    ] as const;
    const messageIndex = (createHash('sha256').update(seed).digest()[0] ?? 0) % messages.length;
    const message = messages.at(messageIndex) ?? messages[0];
    return {
      assetType,
      mediaType: 'text/plain; charset=utf-8',
      content: Buffer.from(message, 'utf8'),
      widthPixels: null,
      heightPixels: null,
      durationSeconds: null,
      moderationStatus: 'not_required',
    };
  }

  private image(seed: string): string {
    const digest = createHash('sha256').update(seed).digest();
    const hue = digest.readUInt16BE(0) % 360;
    const accent = (hue + 42) % 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400" role="img" aria-label="Deterministic Souvenote mock card">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 58% 30%)"/><stop offset="1" stop-color="hsl(${accent} 62% 16%)"/></linearGradient></defs>
  <rect width="1000" height="1400" fill="url(#g)"/><circle cx="500" cy="510" r="250" fill="none" stroke="#f2d7a1" stroke-width="8" opacity=".8"/>
  <path d="M250 880 Q500 680 750 880 Q500 1080 250 880Z" fill="#f2d7a1" opacity=".2"/>
  <text x="500" y="500" fill="#fff8e8" font-family="serif" font-size="64" text-anchor="middle">A Souvenote</text>
  <text x="500" y="585" fill="#f2d7a1" font-family="sans-serif" font-size="28" text-anchor="middle" letter-spacing="6">DETERMINISTIC BETA MOCK</text>
</svg>`;
  }

  private song(seed: string): Buffer {
    const sampleRate = 8_000;
    const seconds = 30;
    const dataLength = sampleRate * seconds;
    const output = Buffer.alloc(44 + dataLength);
    output.write('RIFF', 0);
    output.writeUInt32LE(36 + dataLength, 4);
    output.write('WAVEfmt ', 8);
    output.writeUInt32LE(16, 16);
    output.writeUInt16LE(1, 20);
    output.writeUInt16LE(1, 22);
    output.writeUInt32LE(sampleRate, 24);
    output.writeUInt32LE(sampleRate, 28);
    output.writeUInt16LE(1, 32);
    output.writeUInt16LE(8, 34);
    output.write('data', 36);
    output.writeUInt32LE(dataLength, 40);
    const frequency = 220 + (createHash('sha256').update(seed).digest()[0] ?? 0);
    for (let index = 0; index < dataLength; index += 1) {
      const envelope = Math.min(1, index / 800, (dataLength - index) / 800);
      output[44 + index] = 128 + Math.round(Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 18 * envelope);
    }
    return output;
  }

  private failureFor(scenario: string, assetType: GeneratedAssetType): GenerationFailureCategory | null {
    const [kind, target] = scenario.split('_');
    if (target !== assetType) return null;
    if (kind === 'fail') return 'provider_failed';
    if (kind === 'timeout') return 'timed_out';
    if (kind === 'policy') return 'policy_blocked';
    if (kind === 'invalid') return 'invalid_result';
    return null;
  }

  private throwDisabled(): never {
    throw new ConflictException({
      code: 'GENERATION_PROVIDER_DISABLED',
      message: 'Deterministic generation is available only in explicit local/test mock mode.',
    });
  }
}
