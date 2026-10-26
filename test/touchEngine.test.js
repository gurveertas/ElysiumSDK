import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPayload,
  identify,
  createOrder,
  createBooking,
} from '../src/signals/touchEngine.js';
import { configManager } from '../src/config/index.js';

describe('Touch Engine, Conversion & Attribution API Integration', () => {
  beforeEach(() => {
    configManager.init({
      apiKey: 'pk_test_sample_123',
      apiBaseUrl: 'http://localhost:5000',
    });
  });

  it('buildPayload constructs valid payload matching Touch schema', () => {
    const payload = buildPayload({ customKey: 'val' });
    assert.ok(payload.visitorId);
    assert.ok(payload.touchedAt);
    assert.equal(typeof payload.landingPage, 'string');
    assert.equal(payload.customKey, 'val');
  });

  it('identify rejects calls without email or phone', async () => {
    const res = await identify({});
    assert.equal(res.ok, false);
    assert.match(res.error, /requires at least an email or phone/);
  });

  it('createOrder rejects calls without externalId or grossAmount/netAmount', async () => {
    const resNoId = await createOrder({});
    assert.equal(resNoId.ok, false);
    assert.match(resNoId.error, /externalId/);

    const resNoAmount = await createOrder({ externalId: 'ord_1' });
    assert.equal(resNoAmount.ok, false);
    assert.match(resNoAmount.error, /grossAmount/);
  });

  it('createBooking rejects calls without externalId or appointmentStartAt', async () => {
    const resNoId = await createBooking({});
    assert.equal(resNoId.ok, false);
    assert.match(resNoId.error, /externalId/);

    const resNoDate = await createBooking({ externalId: 'book_1' });
    assert.equal(resNoDate.ok, false);
    assert.match(resNoDate.error, /appointmentStartAt/);
  });
});
