import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { MeResponseDto } from '../common/api-response.dto';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: '1990-01-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthday?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ operationId: 'getMe' })
  @ApiOkResponse({ type: MeResponseDto })
  async me(@Req() request: AuthenticatedRequest) {
    return this.authService.getMe(request.user.id);
  }

  @Patch()
  @ApiOperation({ operationId: 'updateMe' })
  @ApiOkResponse({ type: MeResponseDto })
  async updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMe(request.user.id, dto);
  }
}
