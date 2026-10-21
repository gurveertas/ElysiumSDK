import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isInternalReferrer, parseReferrer } from '../src/tracking/referrer.js';

describe('Referrer Parsing and Classification Module', () => {
  it('identifies internal referrals correctly', () => {
    assert.equal(isInternalReferrer('https://mystore.com/catalog', 'mystore.com'), true);
    assert.equal(isInternalReferrer('https://shop.mystore.com/cart', 'mystore.com'), true);
    assert.equal(isInternalReferrer('https://google.com', 'mystore.com'), false);
    assert.equal(isInternalReferrer('', 'mystore.com'), false);
  });

  it('classifies organic search engines', () => {
    const googleResult = parseReferrer('https://www.google.com/search?q=shoes', 'mystore.com');
    assert.equal(googleResult.channel, 'organic_search');
    assert.equal(googleResult.detectedSource, 'google');
    assert.equal(googleResult.detectedMedium, 'organic');

    const bingResult = parseReferrer('https://www.bing.com/', 'mystore.com');
    assert.equal(bingResult.channel, 'organic_search');
    assert.equal(bingResult.detectedSource, 'bing');
  });

  it('classifies social networks', () => {
    const fbResult = parseReferrer('https://l.facebook.com/', 'mystore.com');
    assert.equal(fbResult.channel, 'social');
    assert.equal(fbResult.detectedSource, 'facebook');
    assert.equal(fbResult.detectedMedium, 'social');

    const redditResult = parseReferrer('https://www.reddit.com/r/deals', 'mystore.com');
    assert.equal(redditResult.channel, 'social');
    assert.equal(redditResult.detectedSource, 'reddit');
  });

  it('filters out internal referrers and marks channel as internal', () => {
    const internalResult = parseReferrer('https://mystore.com/products', 'mystore.com');
    assert.equal(internalResult.isInternal, true);
    assert.equal(internalResult.referrer, null);
    assert.equal(internalResult.channel, 'internal');
  });
});
