import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMarketingParams } from '../src/signals/params.js';

describe('Marketing Parameters & Click ID Extraction Module', () => {
  it('extracts standard UTM query parameters', () => {
    const search = '?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=running+shoes&utm_content=banner_ad';
    const { utm } = extractMarketingParams(search);

    assert.equal(utm.source, 'google');
    assert.equal(utm.medium, 'cpc');
    assert.equal(utm.campaign, 'summer_sale');
    assert.equal(utm.term, 'running shoes');
    assert.equal(utm.content, 'banner_ad');
  });

  it('extracts advertising click IDs and synthesizes fbc from fbclid', () => {
    const search = '?gclid=test_gclid_123&fbclid=test_fbclid_456&ttclid=test_ttclid_789&msclkid=test_msclkid_000';
    const { clickIds, cookies } = extractMarketingParams(search);

    assert.equal(clickIds.gclid, 'test_gclid_123');
    assert.equal(clickIds.fbclid, 'test_fbclid_456');
    assert.equal(clickIds.ttclid, 'test_ttclid_789');
    assert.equal(clickIds.msclkid, 'test_msclkid_000');
    assert.ok(cookies.fbc.includes('test_fbclid_456'));
  });

  it('handles empty query parameters without errors', () => {
    const { utm, clickIds } = extractMarketingParams('');
    assert.equal(utm.source, null);
    assert.equal(utm.campaign, null);
    assert.equal(clickIds.gclid, null);
  });
});
