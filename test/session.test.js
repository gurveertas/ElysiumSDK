import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldSendTouch,
  saveSuccessfulTouch,
  readTouchHistory,
  TOUCH_HISTORY_KEY,
} from '../src/signals/session.js';
import { safeLocalStorage } from '../src/utils/storage.js';
import { configManager } from '../src/config/index.js';

describe('Session Tracking and Deduplication Module', () => {
  beforeEach(() => {
    safeLocalStorage.removeItem(TOUCH_HISTORY_KEY);
    configManager.init({
      sessionWindowMs: 30 * 60 * 1000,
    });
  });

  it('allows the initial touch when history is empty', () => {
    const payload = {
      visitorId: 'vis-1',
      source: 'google',
      medium: 'cpc',
      campaign: 'shoes',
    };
    assert.equal(shouldSendTouch(payload, []), true);
  });

  it('rejects duplicate touch with the same signature within the session window', () => {
    const payload = {
      visitorId: 'vis-1',
      source: 'google',
      medium: 'cpc',
      campaign: 'shoes',
      landingPage: 'https://mystore.com/shoes',
    };

    const history = [
      {
        payload,
        response: { id: 't-1', visitorId: 'vis-1', channel: 'cpc', touchedAt: '' },
        recordedAt: Date.now() - 5000, // 5 seconds ago
      },
    ];

    assert.equal(shouldSendTouch(payload, history), false);
  });

  it('protects paid marketing attribution from being overwritten by a direct navigation in the same session', () => {
    const adPayload = {
      visitorId: 'vis-1',
      source: 'facebook',
      medium: 'cpc',
      campaign: 'retargeting',
      fbclid: 'fb_123',
    };

    const directPayload = {
      visitorId: 'vis-1',
      source: null,
      medium: null,
      campaign: null,
    };

    const history = [
      {
        payload: adPayload,
        response: { id: 't-1', visitorId: 'vis-1', channel: 'cpc', touchedAt: '' },
        recordedAt: Date.now() - 60000, // 1 min ago
      },
    ];

    // Direct navigation should not overwrite the active paid touch
    assert.equal(shouldSendTouch(directPayload, history), false);
  });

  it('allows a new touch when session window has expired', () => {
    const payload = {
      visitorId: 'vis-1',
      source: 'google',
      medium: 'cpc',
    };

    const history = [
      {
        payload,
        response: { id: 't-1', visitorId: 'vis-1', channel: 'cpc', touchedAt: '' },
        recordedAt: Date.now() - (35 * 60 * 1000), // 35 minutes ago (> 30 min window)
      },
    ];

    assert.equal(shouldSendTouch(payload, history), true);
  });

  it('limits saved history to 50 items and purges older records (FIFO)', () => {
    for (let i = 0; i < 60; i++) {
      saveSuccessfulTouch({
        payload: { visitorId: 'vis-1', index: i },
        response: { id: `touch-${i}`, visitorId: 'vis-1', channel: 'direct', touchedAt: '' },
        recordedAt: Date.now() + i,
      });
    }

    const history = readTouchHistory();
    assert.equal(history.length, 50);
    assert.equal(history[0].payload.index, 10);
    assert.equal(history[49].payload.index, 59);
  });
});
