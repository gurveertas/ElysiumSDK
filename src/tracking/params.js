import { getCookie } from '../utils/storage.js';
import { getConfig } from '../config/index.js';

function getParam(params, key) {
  return params.get(key) || null;
}

function getQueryParameter(params, name) {
  return params.get(`utm_${name}`) ?? params.get(name) ?? null;
}

/**
 * Extracts marketing parameters, click IDs, ad cookies, and custom parameters.
 */
export function extractMarketingParams(locationSearch = '') {
  const search = locationSearch || (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const config = getConfig();

  // Core UTM parameters
  const utm = {
    source: getQueryParameter(params, 'source'),
    medium: getQueryParameter(params, 'medium'),
    campaign: getQueryParameter(params, 'campaign'),
    term: getQueryParameter(params, 'term'),
    content: getQueryParameter(params, 'content'),
  };

  // Advertising click IDs
  const clickIds = {
    gclid: getParam(params, 'gclid'),
    dclid: getParam(params, 'dclid'),
    wbraid: getParam(params, 'wbraid'),
    gbraid: getParam(params, 'gbraid'),
    srsltid: getParam(params, 'srsltid'),
    fbclid: getParam(params, 'fbclid'),
    ttclid: getParam(params, 'ttclid'),
    msclkid: getParam(params, 'msclkid'),
    twclid: getParam(params, 'twclid'),
    li_fat_id: getParam(params, 'li_fat_id'),
    rdt_cid: getParam(params, 'rdt_cid'),
    epik: getParam(params, 'epik'),
  };

  // Ad cookies
  const cookies = {
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp'),
    ttp: getCookie('_ttp'),
    ga: getCookie('_ga'),
  };

  // Custom parameters defined by developer in elysium.config.js
  const custom = {};
  if (Array.isArray(config.customParams)) {
    for (const key of config.customParams) {
      const val = getParam(params, key);
      if (val !== null) custom[key] = val;
    }
  }

  return {
    utm,
    clickIds,
    cookies,
    custom,
  };
}
