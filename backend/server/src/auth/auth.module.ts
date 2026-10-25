import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { CognitoJwtService } from './cognito-jwt.service';

@Module({
  imports: [CreditsModule],
  controllers: [AuthController],
  providers: [AuthService, CognitoAuthGuard, CognitoJwtService],
  exports: [AuthService, CognitoAuthGuard, CognitoJwtService],
})
export class AuthModule {}
