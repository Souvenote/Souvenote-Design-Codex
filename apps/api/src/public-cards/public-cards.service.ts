import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PublicCardsRepository } from './public-cards.repository';

@Injectable()
export class PublicCardsService {
  constructor(private readonly repository: PublicCardsRepository) {}

  async get(shareToken: string) {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(shareToken)) {
      throw new BadRequestException({ code: 'INVALID_SHARE_TOKEN', message: 'The share token is invalid.' });
    }
    const tokenHash = createHash('sha256').update(shareToken).digest('hex');
    return { card: PublicCardsRepository.toApi(await this.repository.get(tokenHash)) };
  }
}
