import type { ConfigurationReader } from '../config/runtime-config';
import type { PricingRepository } from './pricing.repository';
import { PricingService } from './pricing.service';

const physicalOffer = {
  id: '45000000-0000-4000-8000-000000000001',
  offer_code: 'try_risk_free_one_card',
  offer_type: 'try_risk_free',
  unit_amount_minor: 999,
  authorization_amount_minor: 999,
  no_send_fee_minor: 200,
  authorization_days: 5,
  minimum_quantity: 1,
  maximum_quantity: 1,
  credits_per_card: 10,
  shipping_included: true,
  checkout_enabled: true,
  currency: 'CAD',
  market_country: 'CA',
  metadata: {},
};

const creditPack = {
  id: '45000000-0000-4000-8000-000000000002',
  offer_code: 'credit_pack_10',
  credit_quantity: 10,
  unit_amount_minor: 200,
  checkout_enabled: true,
  currency: 'CAD',
  market_country: 'CA',
  metadata: {},
};

function serviceFor(environment: string, paymentMode: string) {
  const repository = {
    findActiveCanadaOffers: jest.fn().mockResolvedValue([physicalOffer]),
    findActiveCanadaCreditPacks: jest.fn().mockResolvedValue([creditPack]),
  };
  const configuration: ConfigurationReader = {
    get: (key) => ({ NODE_ENV: environment, PAYMENT_PROVIDER_MODE: paymentMode })[key],
  };
  return new PricingService(repository as unknown as PricingRepository, configuration);
}

describe('PricingService checkout capability', () => {
  it('publishes checkout readiness only in explicit local/test mock mode', async () => {
    const local = await serviceFor('test', 'mock').findAll();
    expect(local.data[0]?.checkoutEnabled).toBe(true);
    expect(local.creditPacks[0]?.checkoutEnabled).toBe(true);
  });

  it('masks database catalog readiness in production', async () => {
    const production = await serviceFor('production', 'mock').findAll();
    expect(production.data[0]?.checkoutEnabled).toBe(false);
    expect(production.creditPacks[0]?.checkoutEnabled).toBe(false);
  });
});
