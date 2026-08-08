const admin = require("firebase-admin");

const PROMO_CODES = "promoCodes";
const PROMO_REDEMPTIONS = "promoRedemptions";
const USERS = "users";

function normalizeCode(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function getDb() {
  if (!admin.apps.length) {
    const err = new Error("firebase_not_ready");
    err.code = "firebase_not_ready";
    throw err;
  }
  return admin.firestore();
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const date =
    typeof expiresAt.toDate === "function" ? expiresAt.toDate() : new Date(expiresAt);
  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function evaluatePromoDoc(code, data) {
  if (!data) {
    return { ok: false, error: "invalid_code" };
  }
  if (data.active === false) {
    return { ok: false, error: "invalid_code" };
  }
  if (isExpired(data.expiresAt)) {
    return { ok: false, error: "expired" };
  }
  const max = data.maxRedemptions;
  const count = Number(data.redemptionCount) || 0;
  if (max != null && Number.isFinite(Number(max)) && count >= Number(max)) {
    return { ok: false, error: "max_uses" };
  }
  const type = data.type === "vip" ? "vip" : "referral";
  return {
    ok: true,
    code,
    type,
    messageKey: data.messageKey || null,
  };
}

async function validatePromoCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) {
    return { ok: false, error: "invalid_code" };
  }

  const snap = await getDb().collection(PROMO_CODES).doc(code).get();
  return evaluatePromoDoc(code, snap.exists ? snap.data() : null);
}

async function redeemPromoCode(rawCode, uid) {
  const code = normalizeCode(rawCode);
  if (!code) {
    return { ok: false, error: "invalid_code" };
  }
  if (!uid) {
    return { ok: false, error: "missing_auth" };
  }

  const db = getDb();
  const codeRef = db.collection(PROMO_CODES).doc(code);
  const redemptionRef = db.collection(PROMO_REDEMPTIONS).doc(`${uid}_${code}`);
  const userRef = db.collection(USERS).doc(uid);

  return db.runTransaction(async (tx) => {
    const [codeSnap, redemptionSnap] = await Promise.all([
      tx.get(codeRef),
      tx.get(redemptionRef),
    ]);

    const evaluation = evaluatePromoDoc(code, codeSnap.exists ? codeSnap.data() : null);
    if (!evaluation.ok) {
      return evaluation;
    }

    if (redemptionSnap.exists) {
      return { ok: false, error: "already_redeemed" };
    }

    const data = codeSnap.data();
    const nextCount = (Number(data.redemptionCount) || 0) + 1;

    tx.update(codeRef, {
      redemptionCount: nextCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(redemptionRef, {
      uid,
      code,
      type: evaluation.type,
      redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userPayload = {
      promoCode: code,
      promoBenefitType: evaluation.type,
      promoRedeemedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (evaluation.type === "vip") {
      userPayload.vipPromoActive = true;
    }

    tx.set(userRef, userPayload, { merge: true });

    return {
      ok: true,
      code,
      type: evaluation.type,
      benefitApplied: evaluation.type === "vip",
    };
  });
}

async function upsertPromoCode(definition) {
  const code = normalizeCode(definition.code);
  if (!code) {
    throw new Error("promo code required");
  }

  const payload = {
    active: definition.active !== false,
    type: definition.type === "vip" ? "vip" : "referral",
    maxRedemptions:
      definition.maxRedemptions == null ? null : Number(definition.maxRedemptions),
    redemptionCount: Number(definition.redemptionCount) || 0,
    expiresAt: definition.expiresAt || null,
    messageKey: definition.messageKey || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = getDb().collection(PROMO_CODES).doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(payload, { merge: true });
  return { code, ...payload };
}

module.exports = {
  normalizeCode,
  validatePromoCode,
  redeemPromoCode,
  upsertPromoCode,
};
