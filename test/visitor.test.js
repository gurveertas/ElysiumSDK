import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUUID,
  getVisitorId,
  setVisitorId,
  resetVisitorId,
  VISITOR_ID_KEY,
  LEGACY_VISITOR_ID_KEY,
} from '../src/signals/visitor.js';
import { safeLocalStorage } from '../src/utils/storage.js';

describe('Visitor Identity Management Module', () => {
  beforeEach(() => {
    safeLocalStorage.removeItem(VISITOR_ID_KEY);
    safeLocalStorage.removeItem(LEGACY_VISITOR_ID_KEY);
    resetVisitorId();
  });

  it('generates a valid UUIDv4 structure', () => {
    const uuid = generateUUID();
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(uuid, uuidv4Regex);
  });

  it('creates and persists a new visitorId on first access', () => {
    const id1 = getVisitorId();
    assert.ok(id1);

    // Second call should return identical ID
    const id2 = getVisitorId();
    assert.equal(id1, id2);

    // Should be in safeLocalStorage
    assert.equal(safeLocalStorage.getItem(VISITOR_ID_KEY), id1);
  });

  it('recognizes legacy attr_vid key if existing', () => {
    const legacyId = 'legacy-uuid-1234';
    safeLocalStorage.setItem(LEGACY_VISITOR_ID_KEY, legacyId);

    const resolved = getVisitorId();
    assert.equal(resolved, legacyId);
  });

  it('allows setting custom or canonicalized visitor ID', () => {
    setVisitorId('canonical-custom-id');
    assert.equal(getVisitorId(), 'canonical-custom-id');
  });
});
