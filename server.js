require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const validator = require("validator");
const { sendMagicLinkEmail } = require("./lib/sendMagicLinkEmail");

const PORT = Number(process.env.PORT) || 3000;
const FROM_ADDRESS = "FitScan AI <noreply@fitscanai.app>";

/** Paramètres Firebase pour generateSignInWithEmailLink (continue URL + app iOS + domaine des liens). */
const actionCodeSettings = {
  url: process.env.FIREBASE_CONTINUE_URL || "https://fitscanai.com/universallink",
  handleCodeInApp: true,
  iOS: {
    bundleId: "com.fitscanai.labs",
  },
};

/**
 * Progressive rollout on Railway (set in Variables):
 * - validate_only — steps 1–2 only, JSON 200
 * - fake_link       — + fake link (step 3), no Firebase/Resend
 * - firebase_only   — real Firebase link (steps 4–5), returns link in JSON (debug)
 * - full            — Firebase + Resend (default)
 */
const AUTH_EMAIL_STAGE = (process.env.AUTH_EMAIL_STAGE || "full").toLowerCase();

const FIREBASE_LINK_TIMEOUT_MS = Number(process.env.FIREBASE_LINK_TIMEOUT_MS) || 12000;
const RESEND_TIMEOUT_MS = Number(process.env.RESEND_TIMEOUT_MS) || 12000;

function loadEmailTemplate() {
  try {
    return require("./lib/emailTemplate");
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
    return require("./emailTemplate");
  }
}

const { buildSignInEmailHtml, buildSignInEmailText } = loadEmailTemplate();

function validateEnv() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error("[config] RESEND_API_KEY manquante");
    process.exit(1);
  }
  const hasFirebase =
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim()) ||
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) ||
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) ||
    (Boolean(process.env.FIREBASE_PROJECT_ID?.trim()) &&
      Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim()) &&
      Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim()));
  if (!hasFirebase) {
    const firebaseKeys = Object.keys(process.env).filter((k) => k.startsWith("FIREBASE"));
    console.error(
      "[config] Firebase: FIREBASE_SERVICE_ACCOUNT_BASE64 (Railway), ou JSON, ou PATH fichier local, ou PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY"
    );
    console.error(
      "[config] Variables FIREBASE_* vues par le processus:",
      firebaseKeys.length ? firebaseKeys.join(", ") : "(aucune — vérifie le nom exact: FIREBASE_SERVICE_ACCOUNT_BASE64)"
    );
    process.exit(1);
  }
}

let firebaseReady = false;

function normalizePrivateKey(raw) {
  let key = String(raw ?? "").trim();
  if (key.charCodeAt(0) === 0xfeff) {
    key = key.slice(1).trim();
  }
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  key = key.replace(/\\r\\n/g, "\n");
  key = key.replace(/\\n/g, "\n");
  key = key.replace(/\\\\n/g, "\n");
  return key.trim();
}

function parseServiceAccountFromBase64() {
  let s = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!s?.trim()) return null;
  s = s.trim().replace(/^\uFEFF/, "");
  /** Préfixes parasites souvent collés par erreur (ex. littéral '\n' avant le base64). */
  s = s.replace(/^['"]\\n['"]\s*/i, "");
  s = s.replace(/^\\n\s*/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^['"]\\n['"]\s*/i, "").replace(/^\\n\s*/, "");

  /** JSON brut collé par erreur dans la variable nommée BASE64. */
  if (/^\s*\{/.test(s)) {
    try {
      return JSON.parse(s);
    } catch (_) {
      /* tenter le décodage base64 ci-dessous */
    }
  }

  let b64 = s;
  const b64Idx = b64.indexOf("base64,");
  if (b64Idx !== -1) {
    b64 = b64.slice(b64Idx + "base64,".length);
  }
  b64 = b64.replace(/\s/g, "");
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const mod4 = b64.length % 4;
  if (mod4) {
    b64 += "=".repeat(4 - mod4);
  }

  const buf = Buffer.from(b64, "base64");
  let utf8 = buf.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!utf8.startsWith("{")) {
    throw new Error(
      "après décodage base64 le contenu ne commence pas par { — régénère avec: base64 -i fichier.json | tr -d '\\n' (une seule ligne, sans guillemets parasites)"
    );
  }
  return JSON.parse(utf8);
}

function parseServiceAccountFromJson() {
  const j = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!j) return null;
  return JSON.parse(j);
}

function loadServiceAccountFromFile() {
  const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!p) return null;
  const fs = require("fs");
  const path = require("path");
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(abs)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH introuvable: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

/** Corrige private_key après JSON (\\n littéraux, CRLF, etc.). */
function normalizeServiceAccountPrivateKey(sa) {
  if (!sa?.private_key || typeof sa.private_key !== "string") return sa;
  let pk = sa.private_key.trim();
  pk = pk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (pk.includes("\\n")) {
    pk = pk.replace(/\\n/g, "\n");
  }
  return { ...sa, private_key: pk };
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    firebaseReady = true;
    return;
  }

  let serviceAccount = null;
  try {
    serviceAccount = parseServiceAccountFromBase64();
    if (serviceAccount) {
      console.log("[firebase] Credentials: FIREBASE_SERVICE_ACCOUNT_BASE64");
    }
  } catch (e) {
    console.warn("[firebase] FIREBASE_SERVICE_ACCOUNT_BASE64 invalide:", e.message);
  }

  if (!serviceAccount) {
    try {
      serviceAccount = parseServiceAccountFromJson();
      if (serviceAccount) {
        console.log("[firebase] Credentials: FIREBASE_SERVICE_ACCOUNT_JSON");
      }
    } catch (e) {
      console.warn("[firebase] FIREBASE_SERVICE_ACCOUNT_JSON invalide:", e.message);
    }
  }

  if (!serviceAccount) {
    try {
      serviceAccount = loadServiceAccountFromFile();
      if (serviceAccount) {
        console.log("[firebase] Credentials: fichier", process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim());
      }
    } catch (e) {
      console.warn("[firebase] FIREBASE_SERVICE_ACCOUNT_PATH:", e.message);
    }
  }

  try {
    if (serviceAccount) {
      serviceAccount = normalizeServiceAccountPrivateKey(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseReady = true;
      console.log("[firebase] Admin SDK initialisé — projet:", serviceAccount.project_id);
      return;
    }

    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    const looksLikePem =
      privateKey.includes("BEGIN PRIVATE KEY") ||
      privateKey.includes("BEGIN RSA PRIVATE KEY");
    if (!looksLikePem) {
      console.warn(
        "[firebase] Clé PEM absente ou illisible — sur Railway préférez FIREBASE_SERVICE_ACCOUNT_BASE64 (fichier JSON encodé en base64)."
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    firebaseReady = true;
    console.log("[firebase] Admin SDK initialisé — projet:", process.env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.warn("[firebase] Initialisation impossible:", err.message);
    console.warn(
      "[firebase] Le serveur démarre quand même ; /auth/email-link/send renverra une erreur tant que les identifiants ne sont pas valides."
    );
  }
}

function jsonError(res, status, message) {
  res.status(status).json({ ok: false, error: message });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} timed out after ${ms}ms`);
      e.code = "ETIMEDOUT";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

validateEnv();
initFirebaseAdmin();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = {
  origin:
    !corsOrigin || corsOrigin === "*"
      ? true
      : corsOrigin.split(",").map((o) => o.trim()),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "fitscan-email-backend",
    status: "running",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/auth/email-link/send", async (req, res) => {
  const ROUTE_MS =
    Number(process.env.ROUTE_HARD_TIMEOUT_MS) ||
    FIREBASE_LINK_TIMEOUT_MS + RESEND_TIMEOUT_MS + 5000;

  let finished = false;
  const respond = (status, payload) => {
    if (finished || res.headersSent) {
      console.warn("[auth/email-link] duplicate respond ignored", { status, payload });
      return;
    }
    finished = true;
    clearTimeout(hardTimer);
    console.log("[auth/email-link] HTTP", status, payload);
    return res.status(status).json(payload);
  };

  const hardTimer = setTimeout(() => {
    if (!finished && !res.headersSent) {
      console.error("[auth/email-link] HARD TIMEOUT route after", ROUTE_MS, "ms");
      finished = true;
      res.status(500).json({ ok: false, error: "internal_error", reason: "route_timeout" });
    }
  }, ROUTE_MS);

  try {
    console.log("[step 1] request body:", req.body);

    const raw = req.body?.email;
    if (raw === undefined || raw === null || typeof raw !== "string") {
      return respond(400, { ok: false, error: "missing_email" });
    }

    const email = raw.trim().toLowerCase();
    if (!email) {
      return respond(400, { ok: false, error: "missing_email" });
    }

    if (!validator.isEmail(email)) {
      return respond(400, { ok: false, error: "invalid_email" });
    }

    console.log("[step 2] normalized email:", email);

    if (AUTH_EMAIL_STAGE === "validate_only") {
      return respond(200, { ok: true, stage: "validate_only", email });
    }

    let signInLink = "https://example.com/test-link";
    console.log("[step 3] fake link placeholder:", signInLink);

    if (AUTH_EMAIL_STAGE === "fake_link") {
      return respond(200, { ok: true, email, link: signInLink, stage: "fake_link" });
    }

    if (!firebaseReady) {
      console.error("[step 4] Firebase Admin not ready (firebaseReady=false)");
      return respond(500, { ok: false, error: "firebase_not_ready" });
    }

    console.log("[step 4] BEFORE await generateSignInWithEmailLink", {
      timeoutMs: FIREBASE_LINK_TIMEOUT_MS,
      continueUrl: actionCodeSettings.url,
    });
    try {
      const magicLink = await withTimeout(
        admin.auth().generateSignInWithEmailLink(email, actionCodeSettings),
        FIREBASE_LINK_TIMEOUT_MS,
        "Firebase generateSignInWithEmailLink"
      );
      signInLink = magicLink;
    } catch (fbErr) {
      console.error("[step 4] Firebase FAILED", {
        message: fbErr.message,
        code: fbErr.code,
      });
      if (fbErr.code === "auth/invalid-email") {
        return respond(400, { ok: false, error: "invalid_email" });
      }
      if (fbErr.code === "ETIMEDOUT") {
        return respond(500, { ok: false, error: "firebase_timeout" });
      }
      return respond(500, { ok: false, error: "firebase_error", message: fbErr.message });
    }

    console.log("[step 5] AFTER Firebase, link length:", String(signInLink).length);

    if (AUTH_EMAIL_STAGE === "firebase_only") {
      return respond(200, {
        ok: true,
        email,
        link: signInLink,
        stage: "firebase_only",
      });
    }

    if (AUTH_EMAIL_STAGE !== "full") {
      console.warn("[auth/email-link] unknown AUTH_EMAIL_STAGE, using full:", AUTH_EMAIL_STAGE);
    }

    console.log("[step 6] BEFORE Resend send (tracking off, raw Firebase href)", {
      timeoutMs: RESEND_TIMEOUT_MS,
    });
    let resendResult;
    try {
      resendResult = await withTimeout(
        sendMagicLinkEmail({
          apiKey: process.env.RESEND_API_KEY,
          from: FROM_ADDRESS,
          to: email,
          subject: "Sign in to FitScan AI",
          html: buildSignInEmailHtml(signInLink),
          text: buildSignInEmailText(signInLink),
        }),
        RESEND_TIMEOUT_MS,
        "Resend magic link send"
      );
    } catch (rsErr) {
      console.error("[step 6] Resend throw", { message: rsErr.message, code: rsErr.code });
      if (rsErr.code === "ETIMEDOUT") {
        return respond(500, { ok: false, error: "resend_timeout" });
      }
      return respond(500, { ok: false, error: "resend_error", message: rsErr.message });
    }

    const { data, error } = resendResult;
    console.log("[step 7] AFTER Resend send", { id: data?.id ?? null, hasError: !!error });

    if (error) {
      console.error("[step 7] Resend API error object:", error);
      return respond(500, { ok: false, error: "resend_api_error" });
    }

    return respond(200, { ok: true, email });
  } catch (error) {
    console.error("[route error]", error);
    return respond(500, { ok: false, error: "internal_error" });
  }
});

app.use((_req, res) => {
  jsonError(res, 404, "Not found");
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Écoute sur 0.0.0.0:${PORT}`);
  console.log("[server] POST /auth/email-link/send");
  console.log("[server] AUTH_EMAIL_STAGE =", AUTH_EMAIL_STAGE);
});

server.on("error", (err) => {
  console.error("[server] Démarrage impossible:", err.message);
  process.exit(1);
});
