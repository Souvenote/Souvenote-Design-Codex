import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthService } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import type { AuthenticatedRequest } from './auth.types';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  language?: string;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

export class SavePaymentMethodDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  last4?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  expMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2024)
  @Max(2100)
  expYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  billingName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  billingPostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripePaymentMethodId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(CognitoAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return this.authService.syncCognitoUser(request.cognitoUser);
  }

  @Patch('me')
  @UseGuards(CognitoAuthGuard)
  async updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    const { user } = await this.authService.syncCognitoUser(request.cognitoUser);
    return {
      user: await this.authService.updateUserProfile(user.id, dto),
    };
  }

  @Get('payment-methods')
  @UseGuards(CognitoAuthGuard)
  async paymentMethods(@Req() request: AuthenticatedRequest) {
    const { user } = await this.authService.syncCognitoUser(request.cognitoUser);
    return {
      paymentMethods: await this.authService.listPaymentMethods(user.id),
    };
  }

  @Post('payment-methods')
  @UseGuards(CognitoAuthGuard)
  async createPaymentMethod(@Req() request: AuthenticatedRequest, @Body() dto: SavePaymentMethodDto) {
    const { user } = await this.authService.syncCognitoUser(request.cognitoUser);
    return {
      paymentMethod: await this.authService.createPaymentMethod(user.id, dto),
    };
  }

  @Patch('payment-methods/:paymentMethodId')
  @UseGuards(CognitoAuthGuard)
  async updatePaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: SavePaymentMethodDto,
  ) {
    const { user } = await this.authService.syncCognitoUser(request.cognitoUser);
    return {
      paymentMethod: await this.authService.updatePaymentMethod(user.id, paymentMethodId, dto),
    };
  }

  @Delete('payment-methods/:paymentMethodId')
  @UseGuards(CognitoAuthGuard)
  async deletePaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    const { user } = await this.authService.syncCognitoUser(request.cognitoUser);
    return this.authService.deletePaymentMethod(user.id, paymentMethodId);
  }
}
