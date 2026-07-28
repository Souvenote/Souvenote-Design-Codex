import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class ModeratorGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const groups = this.readGroups(request.cognitoUser?.['cognito:groups']);
    const allowedGroups = new Set(
      (
        this.configService.get<string>('MODERATION_REVIEWER_GROUPS') ||
        'moderators,admin'
      )
        .split(',')
        .map((group) => group.trim())
        .filter(Boolean),
    );

    if (!groups.some((group) => allowedGroups.has(group))) {
      throw new ForbiddenException('Moderator access is required.');
    }

    return true;
  }

  private readGroups(value: unknown) {
    if (Array.isArray(value)) {
      return value.filter(
        (group): group is string => typeof group === 'string' && Boolean(group),
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
