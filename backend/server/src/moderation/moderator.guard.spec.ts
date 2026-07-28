import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ModeratorGuard } from './moderator.guard';

describe('ModeratorGuard', () => {
  const getConfig = jest.fn();
  const guard = new ModeratorGuard({
    get: getConfig,
  } as unknown as ConfigService);

  beforeEach(() => {
    getConfig.mockReset();
  });

  function context(groups?: string[] | string) {
    const request = {
      cognitoUser: {
        ...(groups === undefined ? {} : { 'cognito:groups': groups }),
      },
    } as unknown as AuthenticatedRequest;

    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('allows a configured Cognito reviewer group', () => {
    getConfig.mockReturnValue('reviewers,operations');

    expect(guard.canActivate(context(['customers', 'reviewers']))).toBe(true);
  });

  it('supports Cognito groups represented as a comma-delimited claim', () => {
    getConfig.mockReturnValue(undefined);

    expect(guard.canActivate(context('customers,moderators'))).toBe(true);
  });

  it('denies authenticated users outside reviewer groups', () => {
    getConfig.mockReturnValue(undefined);

    expect(() => guard.canActivate(context(['customers']))).toThrow(
      ForbiddenException,
    );
  });
});
