import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { CognitoJwtService } from './cognito-jwt.service';
import type { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_ROUTE } from './public-route.decorator';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(
    private readonly cognitoJwtService: CognitoJwtService,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Authorization bearer token.');
    }

    request.cognitoUser = await this.cognitoJwtService.verifyToken(token);
    request.authContext = await this.authService.syncCognitoUser(
      request.cognitoUser,
    );
    request.localUser = request.authContext.user;
    return true;
  }
}
