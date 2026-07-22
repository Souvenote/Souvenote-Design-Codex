import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE_KEY } from '../common/public.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { CognitoJwtService } from './cognito-jwt.service';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cognitoJwtService: CognitoJwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization || Array.isArray(authorization) || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token || token.includes(',')) throw new UnauthorizedException('Invalid Authorization bearer token.');
    const claims = await this.cognitoJwtService.verifyToken(token);
    const provisioned = await this.authService.provisionPrincipal(claims);

    request.accessTokenClaims = claims;
    request.user = {
      id: provisioned.user.id,
      cognitoSub: claims.sub,
      email: provisioned.user.email,
    };
    return true;
  }
}
