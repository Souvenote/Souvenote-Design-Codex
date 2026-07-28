import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthService } from './auth.service';
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
  me(@Req() request: AuthenticatedRequest) {
    return request.authContext;
  }

  @Patch('me')
  async updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return {
      user: await this.authService.updateUserProfile(request.localUser.id, dto),
    };
  }

  @Get('payment-methods')
  async paymentMethods(@Req() request: AuthenticatedRequest) {
    return {
      paymentMethods: await this.authService.listPaymentMethods(
        request.localUser.id,
      ),
    };
  }

  @Post('payment-methods')
  async createPaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SavePaymentMethodDto,
  ) {
    return {
      paymentMethod: await this.authService.createPaymentMethod(
        request.localUser.id,
        dto,
      ),
    };
  }

  @Patch('payment-methods/:paymentMethodId')
  async updatePaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: SavePaymentMethodDto,
  ) {
    return {
      paymentMethod: await this.authService.updatePaymentMethod(
        request.localUser.id,
        paymentMethodId,
        dto,
      ),
    };
  }

  @Delete('payment-methods/:paymentMethodId')
  async deletePaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    return this.authService.deletePaymentMethod(
      request.localUser.id,
      paymentMethodId,
    );
  }
}
