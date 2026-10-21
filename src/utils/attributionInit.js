
const API_BASE_URL =
  "https://asbTemp-production.up.railway.app/".replace(/\/+$/, "");

export function initAttribution(apikey) {
  if (!apikey || typeof apikey !== "string") {
    throw new Error("A valid API key is required.");
  }

  if (typeof window === "undefined") return;

  const visitorKey = "aid_vid";

  let visitorId = localStorage.getItem(visitorKey);

  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(visitorKey, visitorId);
  }

  const params = new URLSearchParams(location.search);

  const hasMarketingParams = [
    "utm_source", "utm_medium", "utm_campaign",
    "gclid", "fbclid", "ttclid", "msclkid"
  ].some(key => params.has(key));

  if (!hasMarketingParams) return;

  const payload = {
    visitorId,
    touchedAt: new Date().toISOString(),
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    term: params.get("utm_term"),
    content: params.get("utm_content"),
    referrer: document.referrer || null,
    landingPage: location.href,
    pageTitle: document.title,
    gclid: params.get("gclid"),
    fbclid: params.get("fbclid"),
    ttclid: params.get("ttclid"),
    msclkid: params.get("msclkid")
  };

  return fetch(`${API_BASE_URL}/v1/touches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "authorization": apikey
    },
    body: JSON.stringify(payload),
    keepalive: true
  });
}
