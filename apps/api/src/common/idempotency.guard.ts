import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENCY_REQUIRED_KEY } from './idempotent.decorator';

const VALID_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENCY_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const value = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>().headers['idempotency-key'];
    if (typeof value !== 'string' || !VALID_IDEMPOTENCY_KEY.test(value)) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key must contain 16 to 128 safe characters.',
      });
    }
    return true;
  }
}
