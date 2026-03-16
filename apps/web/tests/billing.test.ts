import { describe, test, expect } from 'bun:test';
import { verifyStripeSignature, timingSafeEqual } from '../src/api/billing';

const TEST_SECRET = 'whsec_test_secret_key';

async function signPayload(body: string, secret: string, timestamp?: number): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${body}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${ts},v1=${hex}`;
}

describe('verifyStripeSignature', () => {
  const validEvent = JSON.stringify({
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: { object: { metadata: { userId: 'u1', plan: 'starter' } } },
  });

  test('accepts valid signature', async () => {
    const sig = await signPayload(validEvent, TEST_SECRET);
    const event = await verifyStripeSignature(validEvent, sig, TEST_SECRET);
    expect(event.id).toBe('evt_test_123');
    expect(event.type).toBe('checkout.session.completed');
  });

  test('rejects wrong secret', async () => {
    const sig = await signPayload(validEvent, 'wrong-secret');
    await expect(verifyStripeSignature(validEvent, sig, TEST_SECRET)).rejects.toThrow('Signature mismatch');
  });

  test('rejects tampered body', async () => {
    const sig = await signPayload(validEvent, TEST_SECRET);
    const tampered = validEvent.replace('evt_test_123', 'evt_evil_456');
    await expect(verifyStripeSignature(tampered, sig, TEST_SECRET)).rejects.toThrow('Signature mismatch');
  });

  test('rejects missing v1 in header', async () => {
    const ts = Math.floor(Date.now() / 1000);
    await expect(verifyStripeSignature(validEvent, `t=${ts}`, TEST_SECRET)).rejects.toThrow(
      'Invalid stripe-signature header',
    );
  });

  test('rejects missing timestamp in header', async () => {
    await expect(verifyStripeSignature(validEvent, 'v1=abcdef', TEST_SECRET)).rejects.toThrow(
      'Invalid stripe-signature header',
    );
  });

  test('rejects expired timestamp (>5 min old)', async () => {
    const oldTs = Math.floor(Date.now() / 1000) - 400;
    const sig = await signPayload(validEvent, TEST_SECRET, oldTs);
    await expect(verifyStripeSignature(validEvent, sig, TEST_SECRET)).rejects.toThrow(
      'Webhook timestamp outside tolerance',
    );
  });

  test('rejects future timestamp (>5 min ahead)', async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 400;
    const sig = await signPayload(validEvent, TEST_SECRET, futureTs);
    await expect(verifyStripeSignature(validEvent, sig, TEST_SECRET)).rejects.toThrow(
      'Webhook timestamp outside tolerance',
    );
  });
});

describe('timingSafeEqual', () => {
  test('returns true for equal strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
  });

  test('returns false for different strings', () => {
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
  });

  test('returns false for different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  test('returns true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  test('returns false for one empty string', () => {
    expect(timingSafeEqual('', 'a')).toBe(false);
  });
});
