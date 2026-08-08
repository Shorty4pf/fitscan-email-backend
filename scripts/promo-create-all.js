#!/usr/bin/env node
/**
 * Crée ou met à jour les codes promo par défaut dans Firestore.
 * Usage : npm run promo:create-all
 */
require("dotenv").config();

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const { upsertPromoCode } = require("../lib/promoService");

const DEFAULT_CODES = [
  {
    code: "FITSCANAI",
    type: "referral",
    messageKey: "community_welcome",
    maxRedemptions: null,
  },
  {
    code: "NORAXVIP",
    type: "vip",
    messageKey: "vip_welcome",
    maxRedemptions: 500,
  },
];

function initFirebase() {
  if (admin.apps.length) return;

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  let serviceAccount = null;
  if (base64) {
    serviceAccount = JSON.parse(Buffer.from(base64.replace(/\s/g, ""), "base64").toString("utf8"));
  } else if (jsonEnv) {
    serviceAccount = JSON.parse(jsonEnv);
  } else if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    serviceAccount = JSON.parse(fs.readFileSync(abs, "utf8"));
  } else {
    const fallback = path.join(process.cwd(), "fit-scan-ai-firebase-adminsdk-fbsvc-9cc9b48d06.json");
    if (fs.existsSync(fallback)) {
      serviceAccount = JSON.parse(fs.readFileSync(fallback, "utf8"));
    }
  }

  if (!serviceAccount) {
    console.error("[promo:create-all] Firebase credentials manquantes.");
    process.exit(1);
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("[promo:create-all] Firebase projet:", serviceAccount.project_id);
}

async function main() {
  initFirebase();
  for (const def of DEFAULT_CODES) {
    const saved = await upsertPromoCode(def);
    console.log("[promo:create-all] OK", saved.code, saved.type);
  }
  console.log("[promo:create-all] Terminé —", DEFAULT_CODES.length, "codes");
}

main().catch((err) => {
  console.error("[promo:create-all] Échec:", err);
  process.exit(1);
});
