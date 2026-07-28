import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FulfillmentSubmissionError,
  type FulfillmentProviderRequest,
} from './fulfillment.provider';
import {
  type ScribelessFetch,
  ScribelessFulfillmentProvider,
} from './scribeless-fulfillment.provider';

describe('ScribelessFulfillmentProvider', () => {
  const settings: Record<string, string> = {
    SCRIBELESS_API_KEY: 'secret-test-key',
    SCRIBELESS_CAMPAIGN_ID: 'campaign-a',
    SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED: 'true',
    SCRIBELESS_CAMPAIGN_SENDER_CONFIRMED: 'true',
    SCRIBELESS_CAMPAIGN_SENDER_ADDRESS_JSON: JSON.stringify({
      firstName: 'Souvenote',
      lastName: 'Team',
      address1: '3 Sender Street',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5V 1A1',
      country: 'CA',
    }),
    SCRIBELESS_REQUEST_TIMEOUT_MS: '5000',
  };
  const get = jest.fn((key: string) => settings[key]);
  const request = jest.fn() as jest.MockedFunction<ScribelessFetch>;
  const provider = new ScribelessFulfillmentProvider(
    { get } as unknown as ConfigService,
    request,
  );
  const fulfillmentRequest: FulfillmentProviderRequest = {
    localFulfillmentId: 'job-a',
    orderId: 'order-a',
    userId: 'user-a',
    recipients: [
      {
        externalId: 'order-a:1',
        address: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          address1: '1 Example Street',
          city: 'London',
          state: 'London',
          postalCode: 'SW1A 1AA',
          country: 'GB',
        },
      },
    ],
    senderAddress: {
      firstName: 'Souvenote',
      lastName: 'Team',
      address1: '3 Sender Street',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5V 1A1',
      country: 'CA',
    },
    frontImageUrl: 'https://assets.example.com/front.png?signature=test',
    insideMessage: 'Happy birthday!',
    qrCodeUrl: 'https://souvenote.example/listen/order-a',
  };

  beforeEach(() => {
    request.mockReset();
    get.mockClear();
  });

  it('validates the folded campaign and submits exact named variables', async () => {
    request
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'campaign-a',
          status: 'live',
          delivery_method: 'directMail',
          frequency: 'recurring',
          variables: [
            { id: 'frontImageUrl' },
            { id: 'insideMessage' },
            { id: 'qrCodeUrl' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'recipient-a',
            status: 'ready',
            campaign_id: 'campaign-a',
            is_rendered: true,
          },
        ]),
      );

    await expect(provider.submit(fulfillmentRequest)).resolves.toMatchObject({
      providerFulfillmentId: 'recipient-a',
      providerRecipientIds: ['recipient-a'],
      providerCampaignId: 'campaign-a',
      providerStatus: 'ready',
      responseMetadata: {
        recipientCount: 1,
        renderedCount: 1,
      },
    });

    expect(request.mock.calls[1]?.[0]).toBe(
      'https://platform.scribeless.co/api/recipients',
    );
    const postInit: RequestInit | undefined = request.mock.calls[1]?.[1];
    expect(postInit?.method).toBe('POST');
    expect(postInit?.headers).toMatchObject({
      'X-API-Key': 'secret-test-key',
    });
    if (typeof postInit?.body !== 'string') {
      throw new Error('Expected a JSON Scribeless request body.');
    }
    const body: unknown = JSON.parse(postInit.body);
    expect(body).toEqual({
      campaignId: 'campaign-a',
      data: [
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
          variables: {
            externalId: 'order-a:1',
            frontImageUrl:
              'https://assets.example.com/front.png?signature=test',
            insideMessage: 'Happy birthday!',
            qrCodeUrl: 'https://souvenote.example/listen/order-a',
          },
        }),
      ],
    });
  });

  it('fails closed until a team-specific folded workflow is confirmed', async () => {
    settings.SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED = 'false';
    await expect(provider.submit(fulfillmentRequest)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(request).not.toHaveBeenCalled();
    settings.SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED = 'true';
  });

  it('rejects a sender that differs from the campaign return address', async () => {
    await expect(
      provider.submit({
        ...fulfillmentRequest,
        senderAddress: {
          ...fulfillmentRequest.senderAddress,
          address1: '99 Different Street',
        },
      }),
    ).rejects.toThrow(
      'The order sender address does not match the confirmed Scribeless campaign return address.',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('marks a provider 5xx as ambiguous to prevent duplicate physical mail', async () => {
    request
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'campaign-a',
          status: 'live',
          delivery_method: 'directMail',
          frequency: 'recurring',
          variables: [
            { id: 'frontImageUrl' },
            { id: 'insideMessage' },
            { id: 'qrCodeUrl' },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response('temporary outage', { status: 503 }));

    let error: unknown;
    try {
      await provider.submit(fulfillmentRequest);
    } catch (caught: unknown) {
      error = caught;
    }
    expect(error).toBeInstanceOf(FulfillmentSubmissionError);
    expect((error as FulfillmentSubmissionError).outcomeUnknown).toBe(true);
  });

  it('polls every stored recipient and reports the least advanced status', async () => {
    request
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'recipient-a',
          status: 'shipped',
          is_rendered: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'recipient-b',
          status: 'in progress',
          is_rendered: true,
        }),
      );

    await expect(
      provider.fetchStatus(['recipient-a', 'recipient-b']),
    ).resolves.toMatchObject({
      providerStatus: 'in_progress',
      recipientStatuses: [
        { id: 'recipient-a', status: 'shipped' },
        { id: 'recipient-b', status: 'in progress' },
      ],
    });
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
