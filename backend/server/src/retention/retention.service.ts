import { Injectable } from '@nestjs/common';
import { RETENTION_POLICY } from './retention-policy';

@Injectable()
export class RetentionService {
  getPolicy() {
    return RETENTION_POLICY;
  }
}
