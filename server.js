require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const validator = require("validator");
const { sendMagicLinkEmail } = require("./lib/sendMagicLinkEmail");

const PORT = Number(process.env.PORT) || 3000;
const FROM_ADDRESS = "FitScan AI <noreply@fitscanai.app>";
const CONTINUE_URL = "https://fit-scan-ai.firebaseapp.com";

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

const REQUIRED_ENV = [
  "RESEND_API_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === ""
  );
  if (missing.length > 0) {
    console.error("[config] Variables d'environnement manquantes:", missing.join(", "));
    process.exit(1);
  }
}

let firebaseReady = false;

function normalizePrivateKey(raw) {
  let key = String(raw ?? "").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    firebaseReady = true;
    return;
  }

  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const looksLikePem =
    privateKey.includes("BEGIN PRIVATE KEY") ||
    privateKey.includes("BEGIN RSA PRIVATE KEY");
  if (!looksLikePem) {
    console.warn(
      "[firebase] Clé privée absente ou non-PEM — collez la clé du JSON (private_key) avec \\n à la place des retours à la ligne, ou guillemets doubles autour de la valeur."
    );
    return;
  }

  try {
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
    });
    try {
      signInLink = await withTimeout(
        admin.auth().generateSignInWithEmailLink(email, {
          url: CONTINUE_URL,
          handleCodeInApp: true,
          iOS: { bundleId: "com.fitscanai.labs" },
        }),
        FIREBASE_LINK_TIMEOUT_MS,
        "Firebase generateSignInWithEmailLink"
      );
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
