import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { CognitoJwtService } from './cognito-jwt.service';

@Module({
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, CognitoAuthGuard, CognitoJwtService],
  exports: [AuthService, CognitoAuthGuard, CognitoJwtService],
})
export class AuthModule {}
