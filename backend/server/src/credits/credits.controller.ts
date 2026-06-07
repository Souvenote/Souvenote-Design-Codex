import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, IsString } from 'class-validator';
import { CreditsService } from './credits.service';

export class CreditActionDto {
  @IsString()
  userId: string;

  @IsNumber()
  amount: number;

  @IsString()
  source: string;

  @IsString()
  idempotencyKey: string;
}

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: string) {
    return this.creditsService.findBalance(userId);
  }

  @Post('grant')
  async grant(@Body() dto: CreditActionDto) {
    return this.creditsService.grant(
      dto.userId,
      dto.amount,
      dto.source,
      dto.idempotencyKey,
    );
  }

  @Post('deduct')
  async deduct(@Body() dto: CreditActionDto) {
    return this.creditsService.deduct(
      dto.userId,
      dto.amount,
      dto.source,
      dto.idempotencyKey,
    );
  }

  @Post('refund')
  async refund(@Body() dto: CreditActionDto) {
    return this.creditsService.refund(
      dto.userId,
      dto.amount,
      dto.source,
      dto.idempotencyKey,
    );
  }
}
