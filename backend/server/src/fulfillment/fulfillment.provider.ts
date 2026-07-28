export type FulfillmentProviderMode = 'mock' | 'scribeless';

export type FulfillmentPostalAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type FulfillmentProviderRequest = {
  localFulfillmentId: string;
  orderId: string;
  userId: string;
  recipients: Array<{
    externalId: string;
    address: FulfillmentPostalAddress;
  }>;
  senderAddress: FulfillmentPostalAddress;
  frontImageUrl: string | null;
  insideMessage: string;
  qrCodeUrl: string | null;
};

export type FulfillmentProviderResult = {
  providerFulfillmentId: string;
  providerRecipientIds: string[];
  providerCampaignId: string | null;
  providerStatus: string;
  estimatedDelivery: string | null;
  responseMetadata: Record<string, unknown>;
};

export type FulfillmentProviderStatusResult = {
  providerStatus: string;
  recipientStatuses: Array<{
    id: string;
    status: string;
    isRendered: boolean | null;
  }>;
  responseMetadata: Record<string, unknown>;
};

export interface FulfillmentProvider {
  readonly mode: FulfillmentProviderMode;
  submit(
    request: FulfillmentProviderRequest,
  ): Promise<FulfillmentProviderResult>;
  fetchStatus(
    providerRecipientIds: string[],
  ): Promise<FulfillmentProviderStatusResult>;
}

export class FulfillmentSubmissionError extends Error {
  constructor(
    message: string,
    readonly outcomeUnknown: boolean,
  ) {
    super(message);
    this.name = 'FulfillmentSubmissionError';
  }
}
