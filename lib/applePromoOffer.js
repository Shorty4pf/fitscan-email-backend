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
  let raw = process.env.APP_STORE_IAP_PRIVATE_KEY?.trim() || "";
  if (!raw) return "";
  raw = raw.replace(/^["']|["']$/g, "").replace(/\r/g, "").replace(/\\n/g, "\n");
  if (!raw.includes("BEGIN")) {
    const body = raw.replace(/\s+/g, "");
    if (!body) return "";
    const lines = body.match(/.{1,64}/g) || [body];
    return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
  }
  const match = raw.match(/-----BEGIN ([A-Z0-9 ]+)-----([A-Za-z0-9+/=\s]+)-----END \1-----/);
  if (!match) return raw;
  const type = match[1];
  const body = match[2].replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) || [body];
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----\n`;
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

  let keyObject;
  try {
    keyObject = crypto.createPrivateKey({ key: privateKeyPem(), format: "pem" });
  } catch (err) {
    const wrap = new Error("apple_offer_key_invalid");
    wrap.code = "apple_offer_key_invalid";
    wrap.cause = err;
    throw wrap;
  }

  const sign = crypto.createSign("SHA256");
  sign.update(payload, "utf8");
  sign.end();
  let signature;
  try {
    signature = sign.sign({ key: keyObject, dsaEncoding: "ieee-p1363" }).toString("base64");
  } catch (err) {
    const wrap = new Error("apple_offer_sign_failed");
    wrap.code = "apple_offer_sign_failed";
    wrap.cause = err;
    throw wrap;
  }

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
