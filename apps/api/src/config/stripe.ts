import Stripe from 'stripe';

import { env } from './env';

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
    typescript: true,
    appInfo: { name: 'VideoRankingStudio', version: '0.1.0' },
    maxNetworkRetries: 3,
  });
  return _stripe;
}

/** Map a plan code + interval to the configured Stripe price id. */
export function priceIdFor(
  code: 'CREATOR' | 'BUSINESS',
  interval: 'MONTH' | 'YEAR',
): string | undefined {
  if (code === 'CREATOR') {
    return interval === 'YEAR' ? env.STRIPE_PRICE_CREATOR_ANNUAL : env.STRIPE_PRICE_CREATOR_MONTHLY;
  }
  return interval === 'YEAR' ? env.STRIPE_PRICE_BUSINESS_ANNUAL : env.STRIPE_PRICE_BUSINESS_MONTHLY;
}
