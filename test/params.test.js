import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMarketingParams } from '../src/tracking/params.js';
import { configManager } from '../src/config/index.js';

describe('Marketing Parameters Extraction Module', () => {
  it('extracts standard UTM parameters', () => {
    const search = '?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=shoes&utm_content=banner_top';
    const result = extractMarketingParams(search);

    assert.equal(result.utm.source, 'google');
    assert.equal(result.utm.medium, 'cpc');
    assert.equal(result.utm.campaign, 'summer_sale');
    assert.equal(result.utm.term, 'shoes');
    assert.equal(result.utm.content, 'banner_top');
  });

  it('falls back to short query parameters if utm_ prefix is omitted', () => {
    const search = '?source=newsletter&medium=email&campaign=welcome_flow';
    const result = extractMarketingParams(search);

    assert.equal(result.utm.source, 'newsletter');
    assert.equal(result.utm.medium, 'email');
    assert.equal(result.utm.campaign, 'welcome_flow');
  });

  it('extracts multi-platform ad click IDs', () => {
    const search = '?gclid=test_gclid_123&fbclid=test_fbclid_456&ttclid=test_ttclid_789&msclkid=test_msclkid_101&wbraid=test_wbraid_202&li_fat_id=test_linkedin_303';
    const result = extractMarketingParams(search);

    assert.equal(result.clickIds.gclid, 'test_gclid_123');
    assert.equal(result.clickIds.fbclid, 'test_fbclid_456');
    assert.equal(result.clickIds.ttclid, 'test_ttclid_789');
    assert.equal(result.clickIds.msclkid, 'test_msclkid_101');
    assert.equal(result.clickIds.wbraid, 'test_wbraid_202');
    assert.equal(result.clickIds.li_fat_id, 'test_linkedin_303');
  });

  it('extracts configured custom query parameters', () => {
    configManager.init({
      customParams: ['affiliate_id', 'promo_code'],
    });

    const search = '?affiliate_id=aff_9988&promo_code=SAVE20&other=ignored';
    const result = extractMarketingParams(search);

    assert.equal(result.custom.affiliate_id, 'aff_9988');
    assert.equal(result.custom.promo_code, 'SAVE20');
    assert.equal(result.custom.other, undefined);
  });
});
