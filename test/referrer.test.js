import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isInternalReferrer, parseReferrer } from '../src/signals/referrer.js';

describe('Referrer Parsing & Channel Classification Module', () => {
  it('correctly classifies internal referrers on same or subdomain', () => {
    assert.equal(isInternalReferrer('https://shop.example.com/checkout', 'example.com'), true);
    assert.equal(isInternalReferrer('https://example.com/blog', 'example.com'), true);
    assert.equal(isInternalReferrer('https://google.com/search', 'example.com'), false);
  });

  it('classifies organic search referrers', () => {
    const parsed = parseReferrer('https://www.google.com/search?q=shoes', 'mystore.com');
    assert.equal(parsed.channel, 'organic_search');
    assert.equal(parsed.detectedSource, 'google');
    assert.equal(parsed.detectedMedium, 'organic');
  });

  it('classifies social network referrers', () => {
    const fb = parseReferrer('https://l.facebook.com/', 'mystore.com');
    assert.equal(fb.channel, 'social');
    assert.equal(fb.detectedSource, 'facebook');

    const tw = parseReferrer('https://t.co/abcxyz', 'mystore.com');
    assert.equal(tw.channel, 'social');
    assert.equal(tw.detectedSource, 'twitter');
  });

  it('classifies generic referral traffic', () => {
    const ref = parseReferrer('https://techcrunch.com/article', 'mystore.com');
    assert.equal(ref.channel, 'referral');
    assert.equal(ref.detectedSource, 'techcrunch.com');
  });

  it('classifies direct traffic when no referrer provided', () => {
    const direct = parseReferrer('', 'mystore.com');
    assert.equal(direct.channel, 'direct');
    assert.equal(direct.referrer, null);
  });
});
