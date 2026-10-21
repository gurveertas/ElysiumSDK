/**
 * Referrer analysis module: distinguishes internal referrals from external,
 * and classifies organic search and social traffic.
 */

const SEARCH_ENGINES = [
  { name: 'google', pattern: /(?:^|\.)google\./i },
  { name: 'bing', pattern: /(?:^|\.)bing\.com/i },
  { name: 'yahoo', pattern: /(?:^|\.)yahoo\.com/i },
  { name: 'duckduckgo', pattern: /(?:^|\.)duckduckgo\.com/i },
  { name: 'baidu', pattern: /(?:^|\.)baidu\.com/i },
  { name: 'yandex', pattern: /(?:^|\.)yandex\./i },
  { name: 'ecosia', pattern: /(?:^|\.)ecosia\.org/i },
];

const SOCIAL_NETWORKS = [
  { name: 'facebook', pattern: /(?:^|\.)(?:facebook\.com|fb\.com|l\.facebook\.com)/i },
  { name: 'instagram', pattern: /(?:^|\.)instagram\.com/i },
  { name: 'linkedin', pattern: /(?:^|\.)linkedin\.com/i },
  { name: 'twitter', pattern: /(?:^|\.)(?:twitter\.com|t\.co|x\.com)/i },
  { name: 'pinterest', pattern: /(?:^|\.)pinterest\./i },
  { name: 'reddit', pattern: /(?:^|\.)reddit\.com/i },
  { name: 'youtube', pattern: /(?:^|\.)youtube\.com/i },
  { name: 'tiktok', pattern: /(?:^|\.)tiktok\.com/i },
];

/**
 * Check if the referrer hostname belongs to the same domain
 */
export function isInternalReferrer(referrerUrl, currentHostname = '') {
  if (!referrerUrl) return false;
  try {
    const refHost = new URL(referrerUrl).hostname.toLowerCase();
    const currHost = (
      currentHostname || (typeof window !== 'undefined' ? window.location.hostname : '')
    ).toLowerCase();

    if (!currHost || !refHost) return false;
    if (refHost === currHost) return true;

    // Check parent domain (e.g. shop.mystore.com and mystore.com)
    const refParts = refHost.split('.');
    const currParts = currHost.split('.');
    if (refParts.length >= 2 && currParts.length >= 2) {
      const refRoot = refParts.slice(-2).join('.');
      const currRoot = currParts.slice(-2).join('.');
      if (refRoot === currRoot) return true;
    }
  } catch {
    // Malformed referrer
  }
  return false;
}

/**
 * Parse referrer to identify organic search and social channels
 */
export function parseReferrer(rawReferrer = '', currentHostname = '') {
  const referrer = rawReferrer || (typeof document !== 'undefined' ? document.referrer : '');
  if (!referrer) {
    return { referrer: null, isInternal: false, channel: 'direct', detectedSource: null, detectedMedium: null };
  }

  if (isInternalReferrer(referrer, currentHostname)) {
    return { referrer: null, isInternal: true, channel: 'internal', detectedSource: null, detectedMedium: null };
  }

  try {
    const refUrl = new URL(referrer);
    const host = refUrl.hostname.toLowerCase();

    for (const se of SEARCH_ENGINES) {
      if (se.pattern.test(host)) {
        return {
          referrer,
          isInternal: false,
          channel: 'organic_search',
          detectedSource: se.name,
          detectedMedium: 'organic',
        };
      }
    }

    for (const sn of SOCIAL_NETWORKS) {
      if (sn.pattern.test(host)) {
        return {
          referrer,
          isInternal: false,
          channel: 'social',
          detectedSource: sn.name,
          detectedMedium: 'social',
        };
      }
    }

    return {
      referrer,
      isInternal: false,
      channel: 'referral',
      detectedSource: host,
      detectedMedium: 'referral',
    };
  } catch {
    return { referrer, isInternal: false, channel: 'unknown', detectedSource: null, detectedMedium: null };
  }
}
