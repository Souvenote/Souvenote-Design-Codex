import { Injectable } from '@nestjs/common';
import type {
  FulfillmentProvider,
  FulfillmentProviderRequest,
} from './fulfillment.provider';

@Injectable()
export class MockFulfillmentProvider implements FulfillmentProvider {
  readonly mode = 'mock' as const;

  async submit(request: FulfillmentProviderRequest) {
    await Promise.resolve();
    const providerRecipientIds = request.recipients.map(
      (_, index) => `mock_recipient_${request.localFulfillmentId}_${index + 1}`,
    );
    return {
      providerFulfillmentId: `mock_fulfillment_${request.localFulfillmentId}`,
      providerRecipientIds,
      providerCampaignId: null,
      providerStatus: 'fulfilled_mock',
      estimatedDelivery: 'Mock delivery estimate: 5-7 business days.',
      responseMetadata: {
        mock: true,
        recipientCount: providerRecipientIds.length,
        message: 'Mock fulfillment completed locally.',
      },
    };
  }

  async fetchStatus(providerRecipientIds: string[]) {
    await Promise.resolve();
    return {
      providerStatus: 'fulfilled_mock',
      recipientStatuses: providerRecipientIds.map((id) => ({
        id,
        status: 'fulfilled_mock',
        isRendered: true,
      })),
      responseMetadata: { mock: true },
    };
  }
}
