const admin = require("firebase-admin");

const PROMO_CODES = "promoCodes";
const PROMO_REDEMPTIONS = "promoRedemptions";
const USERS = "users";

function catalogDiscountForCode(code) {
  switch (normalizeCode(code)) {
    case "NORAX20":
      return 20;
    default:
      return null;
  }
}

function catalogAppleOfferId(code) {
  switch (normalizeCode(code)) {
    case "NORAX20":
      return "NORAX20";
    default:
      return null;
  }
}

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
  const rawDiscount = Number(data.discountPercent);
  const catalogDiscount = catalogDiscountForCode(code);
  const discountPercent =
    catalogDiscount != null
      ? catalogDiscount
      : Number.isFinite(rawDiscount)
        ? Math.min(100, Math.max(0, Math.round(rawDiscount)))
        : type === "vip"
          ? 100
          : 0;
  const appleOfferId =
    catalogAppleOfferId(code) ||
    (typeof data.appleOfferId === "string" && data.appleOfferId.trim()
      ? data.appleOfferId.trim()
      : discountPercent > 0 && discountPercent < 100
        ? code
        : null);
  return {
    ok: true,
    code,
    type,
    messageKey: data.messageKey || null,
    discountPercent,
    appleOfferId,
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
      promoDiscountPercent: evaluation.discountPercent,
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
      discountPercent: evaluation.discountPercent,
      benefitApplied: evaluation.type === "vip",
    };
  });
}

async function upsertPromoCode(definition) {
  const code = normalizeCode(definition.code);
  if (!code) {
    throw new Error("promo code required");
  }

  const catalogDiscount = catalogDiscountForCode(code);
  const payload = {
    active: definition.active !== false,
    type: definition.type === "vip" ? "vip" : "referral",
    maxRedemptions:
      definition.maxRedemptions == null ? null : Number(definition.maxRedemptions),
    expiresAt: definition.expiresAt || null,
    messageKey: definition.messageKey || null,
    appleOfferId:
      definition.appleOfferId ||
      catalogAppleOfferId(code) ||
      null,
    discountPercent:
      catalogDiscount != null
        ? catalogDiscount
        : definition.discountPercent == null
          ? definition.type === "vip"
            ? 100
            : 0
          : Math.min(100, Math.max(0, Number(definition.discountPercent))),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = getDb().collection(PROMO_CODES).doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    payload.redemptionCount = Number(definition.redemptionCount) || 0;
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (definition.redemptionCount != null) {
    payload.redemptionCount = Number(definition.redemptionCount);
  }
  await ref.set(payload, { merge: true });
  return { code, ...payload };
}


async function deleteUserPromoData(uid) {
  if (!uid) return { redemptions: 0 };
  const db = getDb();
  const snap = await db.collection(PROMO_REDEMPTIONS).where("uid", "==", uid).get();
  let redemptions = 0;
  const batch = db.batch();
  snap.forEach((doc) => {
    batch.delete(doc.ref);
    redemptions += 1;
  });
  if (redemptions > 0) {
    await batch.commit();
  }
  return { redemptions };
}

module.exports = {
  normalizeCode,
  catalogAppleOfferId,
  validatePromoCode,
  redeemPromoCode,
  upsertPromoCode,
  deleteUserPromoData,
};
