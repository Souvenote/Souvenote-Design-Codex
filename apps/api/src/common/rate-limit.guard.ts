import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { readPositiveInteger, type ConfigurationReader } from '../config/runtime-config';

type Counter = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();
  private readonly maximum: number;
  private readonly maximumKeys: number;
  private readonly windowMs: number;

  constructor(configService: ConfigService) {
    const configuration = configService as ConfigurationReader;
    this.maximum = readPositiveInteger(configuration, 'RATE_LIMIT_MAX_REQUESTS', 120, 10_000);
    this.maximumKeys = readPositiveInteger(configuration, 'RATE_LIMIT_MAX_KEYS', 10_000, 100_000);
    this.windowMs = readPositiveInteger(configuration, 'RATE_LIMIT_WINDOW_MS', 60_000, 3_600_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = `${request.ip ?? request.socket.remoteAddress ?? 'unknown'}:${request.method}:${request.path}`;
    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.prune(now);
      if (!this.counters.has(key) && this.counters.size >= this.maximumKeys) {
        throw this.rateLimitException();
      }
      this.counters.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    current.count += 1;
    if (current.count > this.maximum) {
      throw this.rateLimitException();
    }
    return true;
  }

  private prune(now: number): void {
    if (this.counters.size < this.maximumKeys) return;
    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) this.counters.delete(key);
    }
  }

  private rateLimitException(): HttpException {
    return new HttpException({ code: 'RATE_LIMITED', message: 'Too many requests.' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
