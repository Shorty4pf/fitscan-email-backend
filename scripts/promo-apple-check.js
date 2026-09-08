#!/usr/bin/env node
/**
 * Vérifie le mapping code promo → offre Apple (sans appeler StoreKit).
 */
const { catalogAppleOfferId, normalizeCode } = require("../lib/promoService");
const { resolveOfferId } = require("../lib/applePromoOffer");

const cases = [
  ["NORAX20", "NORAX20"],
  ["norax20", "NORAX20"],
  ["NORAX20", "NORAX20", "NORAX20"],
];

let failed = 0;
for (const [code, expected, explicit] of [
  ["NORAX20", "NORAX20"],
  ["norax20", "NORAX20"],
  ["NORAXVIP", "NORAXVIP"],
]) {
  const got = resolveOfferId(code, explicit);
  const catalog = catalogAppleOfferId(code);
  const ok = code.toUpperCase() === "NORAX20" ? catalog === "NORAX20" && got === "NORAX20" : true;
  console.log(
    ok ? "OK" : "FAIL",
    "code=",
    normalizeCode(code),
    "catalog=",
    catalog,
    "resolve=",
    got
  );
  if (code.toUpperCase() === "NORAX20" && (catalog !== expected || got !== expected)) failed += 1;
}

const bundle = process.env.APP_STORE_BUNDLE_ID?.trim() || "app.noraxai.norax";
const keyOk = Boolean(process.env.APP_STORE_IAP_KEY_ID?.trim() && process.env.APP_STORE_IAP_PRIVATE_KEY?.trim());
console.log("bundleId=", bundle, bundle === "app.noraxai.norax" ? "OK" : "CHECK");
console.log("signingConfigured=", keyOk ? "YES" : "NO (Railway / .env manquant)");
process.exit(failed ? 1 : 0);
