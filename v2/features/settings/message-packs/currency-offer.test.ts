import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IMessagePackPricingData } from '@/types/message-pack';
import { currencyOffer, offerFrom } from './currency-offer';

const pricing = (currencies: ('NGN' | 'USD')[]): IMessagePackPricingData => ({
  messages_per_pack: 10,
  prices: currencies.map((currency) => ({
    currency,
    provider: 'paystack',
    price_minor: currency === 'NGN' ? 200000 : 200,
    price_major: currency === 'NGN' ? 2000 : 2,
  })),
});

test('a buyer in Nigeria is offered both, and keeps the one they chose', () => {
  assert.deepEqual(currencyOffer(pricing(['NGN', 'USD']), 'NGN'), { offered: ['NGN', 'USD'], currency: 'NGN' });
  assert.deepEqual(currencyOffer(pricing(['USD', 'NGN']), 'USD'), { offered: ['NGN', 'USD'], currency: 'USD' });
});

test('a buyer outside Nigeria who once chose Naira is priced in dollars', () => {
  assert.deepEqual(currencyOffer(pricing(['USD']), 'NGN'), { offered: ['USD'], currency: 'USD' });
});

test('before pricing loads, nothing is offered and the stored choice stands', () => {
  assert.deepEqual(currencyOffer(null, 'NGN'), { offered: [], currency: 'NGN' });
});

test('an empty price list offers nothing and keeps the stored choice', () => {
  assert.deepEqual(currencyOffer(pricing([]), 'USD'), { offered: [], currency: 'USD' });
});

test('a buyer in Nigeria who once chose dollars is priced in Naira', () => {
  assert.deepEqual(currencyOffer(pricing(['NGN']), 'USD'), { offered: ['NGN'], currency: 'NGN' });
});

test('the plan list uses the same rule: only what is on sale, the stored choice while it is', () => {
  assert.deepEqual(offerFrom(['USD', 'NGN', 'USD'], 'NGN'), { offered: ['NGN', 'USD'], currency: 'NGN' });
  assert.deepEqual(offerFrom(['USD'], 'NGN'), { offered: ['USD'], currency: 'USD' });
  assert.deepEqual(offerFrom([], 'NGN'), { offered: [], currency: 'NGN' });
});
