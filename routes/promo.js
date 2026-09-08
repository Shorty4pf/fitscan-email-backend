const express = require("express");
const admin = require("firebase-admin");
const { validatePromoCode, redeemPromoCode } = require("../lib/promoService");
const { isConfigured, resolveOfferId, signPromotionalOffer } = require("../lib/applePromoOffer");

const router = express.Router();

function promoJson(res, status, payload) {
  return res.status(status).json(payload);
}

async function verifyBearerUid(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const err = new Error("missing_auth");
    err.code = "missing_auth";
    throw err;
  }
  const decoded = await admin.auth().verifyIdToken(match[1]);
  return decoded.uid;
}

router.post("/validate", async (req, res) => {
  try {
    if (!admin.apps.length) {
      return promoJson(res, 503, { ok: false, error: "firebase_not_ready" });
    }

    const code = req.body?.code;
    if (code === undefined || code === null || typeof code !== "string" || !code.trim()) {
      return promoJson(res, 400, { ok: false, error: "missing_code" });
    }

    const result = await validatePromoCode(code);
    if (!result.ok) {
      return promoJson(res, 400, result);
    }
    return promoJson(res, 200, result);
  } catch (err) {
    console.error("[promo/validate]", err);
    return promoJson(res, 500, { ok: false, error: "internal_error" });
  }
});

router.post("/redeem", async (req, res) => {
  try {
    if (!admin.apps.length) {
      return promoJson(res, 503, { ok: false, error: "firebase_not_ready" });
    }

    const code = req.body?.code;
    if (code === undefined || code === null || typeof code !== "string" || !code.trim()) {
      return promoJson(res, 400, { ok: false, error: "missing_code" });
    }

    let uid;
    try {
      uid = await verifyBearerUid(req);
    } catch (authErr) {
      const codeErr = authErr.code === "missing_auth" ? "missing_auth" : "invalid_auth";
      return promoJson(res, 401, { ok: false, error: codeErr });
    }

    const result = await redeemPromoCode(code, uid);
    if (!result.ok) {
      const status =
        result.error === "already_redeemed" ? 409 : result.error === "invalid_code" ? 404 : 400;
      return promoJson(res, status, result);
    }
    return promoJson(res, 200, result);
  } catch (err) {
    console.error("[promo/redeem]", err);
    return promoJson(res, 500, { ok: false, error: "internal_error" });
  }
});

router.post("/apple-offer-sign", async (req, res) => {
  try {
    const productId = typeof req.body?.productId === "string" ? req.body.productId.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const offerIdRaw = typeof req.body?.offerId === "string" ? req.body.offerId.trim() : "";
    const offerId = resolveOfferId(code, offerIdRaw);
    if (!productId || !offerId) {
      return promoJson(res, 400, { ok: false, error: "missing_offer_params" });
    }

    if (!isConfigured()) {
      return promoJson(res, 503, { ok: false, error: "apple_offer_signing_unavailable" });
    }

    const signed = signPromotionalOffer({
      productId,
      offerId,
      applicationUsername: "",
    });
    return promoJson(res, 200, signed);
  } catch (err) {
    console.error("[promo/apple-offer-sign]", err);
    const code = err.code === "apple_offer_signing_unavailable" || err.code === "missing_offer_params"
      ? err.code
      : "internal_error";
    const status = code === "internal_error" ? 500 : 400;
    return promoJson(res, status, { ok: false, error: code });
  }
});

module.exports = router;
