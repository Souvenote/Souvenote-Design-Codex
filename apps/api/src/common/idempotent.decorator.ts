import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const IDEMPOTENCY_REQUIRED_KEY = 'souvenote.idempotency-required';
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENCY_REQUIRED_KEY, true),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      description: 'Unique 16-128 character retry key scoped to the authenticated operation.',
      schema: { type: 'string', minLength: 16, maxLength: 128 },
    }),
  );
