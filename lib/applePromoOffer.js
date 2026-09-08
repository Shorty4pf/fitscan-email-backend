const crypto = require("crypto");
const { catalogAppleOfferId, normalizeCode } = require("./promoService");

const SEPARATOR = "\u2063";

function bundleId() {
  return (
    process.env.APP_STORE_BUNDLE_ID?.trim() ||
    "app.noraxai.norax"
  );
}

function keyId() {
  return process.env.APP_STORE_IAP_KEY_ID?.trim() || "";
}

function privateKeyPem() {
  const raw = process.env.APP_STORE_IAP_PRIVATE_KEY?.trim() || "";
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n");
}

function isConfigured() {
  return Boolean(keyId() && privateKeyPem());
}

function resolveOfferId(code, explicit) {
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }
  return catalogAppleOfferId(code) || normalizeCode(code);
}

/**
 * Signature StoreKit d’une offre promotionnelle.
 * https://developer.apple.com/documentation/storekit/in-app_purchase/original_api_for_in-app_purchase/subscriptions_and_offers/generating_a_signature_for_promotional_offers
 */
function signPromotionalOffer({ productId, offerId, applicationUsername }) {
  if (!isConfigured()) {
    const err = new Error("apple_offer_signing_unavailable");
    err.code = "apple_offer_signing_unavailable";
    throw err;
  }
  if (!productId || !offerId) {
    const err = new Error("missing_offer_params");
    err.code = "missing_offer_params";
    throw err;
  }

  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const username = applicationUsername ? String(applicationUsername) : "";
  const payload = [
    bundleId(),
    keyId(),
    productId,
    offerId,
    username,
    nonce.toLowerCase(),
    String(timestamp),
  ].join(SEPARATOR);

  const sign = crypto.createSign("SHA256");
  sign.update(payload, "utf8");
  sign.end();
  const signature = sign.sign(
    { key: privateKeyPem(), dsaEncoding: "ieee-p1363" }
  ).toString("base64");

  return {
    ok: true,
    offerId,
    productId,
    keyId: keyId(),
    nonce,
    timestamp,
    signature,
  };
}

module.exports = {
  isConfigured,
  resolveOfferId,
  signPromotionalOffer,
};
