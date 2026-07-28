import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OperationsGuard } from './operations.guard';

describe('OperationsGuard', () => {
  const getConfig = jest.fn();
  const guard = new OperationsGuard({
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

  function configure(values: Record<string, string | undefined>) {
    getConfig.mockImplementation((key: string) => values[key]);
  }

  it('allows an exact configured Cognito operations group', () => {
    configure({ OPERATIONS_READER_GROUPS: 'incident-readers,admin' });

    expect(guard.canActivate(context(['customers', 'incident-readers']))).toBe(
      true,
    );
  });

  it('supports Cognito groups represented as a comma-delimited claim', () => {
    configure({});

    expect(guard.canActivate(context('customers,operations'))).toBe(true);
  });

  it('denies authenticated customers and unrelated privileged groups', () => {
    configure({});

    expect(() =>
      guard.canActivate(context(['customers', 'moderators'])),
    ).toThrow(ForbiddenException);
  });

  it('rejects wildcard allowlists', () => {
    configure({ OPERATIONS_READER_GROUPS: '*' });

    expect(() => guard.canActivate(context(['operations']))).toThrow(
      InternalServerErrorException,
    );
  });

  it('requires an explicit production allowlist', () => {
    configure({ NODE_ENV: 'production' });

    expect(() => guard.canActivate(context(['operations']))).toThrow(
      InternalServerErrorException,
    );
  });
});
