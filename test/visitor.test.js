import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateUUID, getVisitorId, setVisitorId, VISITOR_ID_KEY } from '../src/tracking/visitor.js';
import { safeLocalStorage } from '../src/utils/storage.js';

describe('Visitor Tracking Module', () => {
  beforeEach(() => {
    safeLocalStorage.removeItem(VISITOR_ID_KEY);
    // Reset memory cache if any
    setVisitorId('');
  });

  it('generates a valid UUIDv4 string', () => {
    const uuid = generateUUID();
    assert.equal(typeof uuid, 'string');
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates and persists visitorId', () => {
    const id1 = getVisitorId();
    assert.ok(id1);
    assert.equal(typeof id1, 'string');

    // Calling again returns the exact same visitorId
    const id2 = getVisitorId();
    assert.equal(id1, id2);
  });

  it('allows explicit override with setVisitorId', () => {
    const customId = 'custom-visitor-12345';
    setVisitorId(customId);
    assert.equal(getVisitorId(), customId);
    assert.equal(safeLocalStorage.getItem(VISITOR_ID_KEY), customId);
  });
});
