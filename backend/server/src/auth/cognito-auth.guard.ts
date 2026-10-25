import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoJwtService } from './cognito-jwt.service';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(private readonly cognitoJwtService: CognitoJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    return true;
  }
}
