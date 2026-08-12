import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PostalAddressInput } from '../orders/orders.service';
import type { FulfillmentVariant } from './fulfillment.repository';

type ProviderAsset = Readonly<{
  storageKey: string;
  contentSha256: string;
  mediaType: string;
}>;

export type ScribelessSubmission = Readonly<{
  contractVersion: 'scribeless.mock.v1';
  idempotencyKey: string;
  orderId: string;
  orderNumber: string;
  variant: FulfillmentVariant;
  quantity: number;
  recipientAddress: PostalAddressInput;
  senderAddress: PostalAddressInput;
  artwork: ProviderAsset | null;
  insideMessage: ProviderAsset | null;
  qr: Readonly<{ publicPath: string; payloadVersion: number }> | null;
}>;

export type ScribelessSubmissionResult = Readonly<{
  provider: 'mock';
  providerJobId: string;
  accepted: true;
  responsePayloadSha256: string;
}>;

export interface ScribelessAdapter {
  submit(request: ScribelessSubmission): Promise<ScribelessSubmissionResult>;
}

/** Typed deterministic boundary; it performs no network, print, or paid action. */
@Injectable()
export class DeterministicScribelessAdapter implements ScribelessAdapter {
  submit(request: ScribelessSubmission): Promise<ScribelessSubmissionResult> {
    const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const response = { providerJobId: `mock_print_${requestHash.slice(0, 32)}`, accepted: true as const };
    return Promise.resolve({
      provider: 'mock',
      ...response,
      responsePayloadSha256: createHash('sha256').update(JSON.stringify(response)).digest('hex'),
    });
  }
}
