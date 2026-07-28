import { MockFulfillmentProvider } from './mock-fulfillment.provider';

describe('MockFulfillmentProvider', () => {
  it('returns deterministic recipient identifiers for idempotent local tests', async () => {
    const provider = new MockFulfillmentProvider();
    const request = {
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
        {
          externalId: 'order-a:2',
          address: {
            firstName: 'Grace',
            lastName: 'Hopper',
            address1: '2 Example Street',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
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
      frontImageUrl: null,
      insideMessage: 'A saved message.',
      qrCodeUrl: null,
    };

    await expect(provider.submit(request)).resolves.toMatchObject({
      providerFulfillmentId: 'mock_fulfillment_job-a',
      providerRecipientIds: [
        'mock_recipient_job-a_1',
        'mock_recipient_job-a_2',
      ],
      providerStatus: 'fulfilled_mock',
    });
    await expect(provider.submit(request)).resolves.toMatchObject({
      providerFulfillmentId: 'mock_fulfillment_job-a',
      providerRecipientIds: [
        'mock_recipient_job-a_1',
        'mock_recipient_job-a_2',
      ],
    });
  });
});
