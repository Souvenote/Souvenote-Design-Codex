import { Injectable } from '@nestjs/common';
import { CreditsRepository } from './credits.repository';

@Injectable()
export class CreditsService {
  constructor(private readonly repository: CreditsRepository) {}

  async findBalance(userId: string) {
    return { balance: await this.repository.findBalance(userId) };
  }
}
