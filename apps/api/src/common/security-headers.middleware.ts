import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { runtimeEnvironment } from '../config/runtime-config';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly production: boolean;

  constructor(configService: ConfigService) {
    this.production = runtimeEnvironment(configService) === 'production';
  }

  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    response.setHeader('cross-origin-opener-policy', 'same-origin');
    response.setHeader('cross-origin-resource-policy', 'same-site');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-dns-prefetch-control', 'off');
    response.setHeader('x-frame-options', 'DENY');
    if (this.production) response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    next();
  }
}
