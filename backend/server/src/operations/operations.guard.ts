import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class OperationsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowedGroups = this.allowedGroups();
    const callerGroups = this.claimGroups(
      request.cognitoUser?.['cognito:groups'],
    );

    if (!callerGroups.some((group) => allowedGroups.has(group))) {
      throw new ForbiddenException('Operations read access is required.');
    }

    return true;
  }

  private allowedGroups() {
    const configured = this.configService
      .get<string>('OPERATIONS_READER_GROUPS')
      ?.trim();
    const nodeEnvironment = this.configService
      .get<string>('NODE_ENV')
      ?.trim()
      .toLowerCase();
    if (!configured && nodeEnvironment === 'production') {
      throw new InternalServerErrorException(
        'OPERATIONS_READER_GROUPS is required in production.',
      );
    }

    const groups = (configured || 'operations,admin')
      .split(',')
      .map((group) => group.trim())
      .filter(Boolean);
    if (!groups.length || groups.includes('*')) {
      throw new InternalServerErrorException(
        'OPERATIONS_READER_GROUPS must contain explicit Cognito group names.',
      );
    }
    return new Set(groups);
  }

  private claimGroups(value: unknown) {
    if (Array.isArray(value)) {
      return value.filter(
        (group): group is string =>
          typeof group === 'string' && Boolean(group.trim()),
      );
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((group) => group.trim())
        .filter(Boolean);
    }
    return [];
  }
}
