require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const validator = require("validator");

function loadEmailTemplate() {
  try {
    return require("./lib/emailTemplate");
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
    return require("./emailTemplate");
  }
}

const { buildSignInEmailHtml } = loadEmailTemplate();

const PORT = Number(process.env.PORT) || 3000;
const FROM_ADDRESS = "FitScan AI <noreply@fitscanai.app>";
const CONTINUE_URL = "https://fit-scan-ai.firebaseapp.com";

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

function jsonOk(res) {
  res.status(200).json({ ok: true });
}

function jsonError(res, status, message) {
  res.status(status).json({ ok: false, error: message });
}

validateEnv();
initFirebaseAdmin();

const resend = new Resend(process.env.RESEND_API_KEY);

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
app.use(express.json({ limit: "32kb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "fitscan-email-backend",
    status: "running",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
  });
});

app.post("/auth/email-link/send", async (req, res) => {
  const rawEmail = req.body?.email;

  if (rawEmail === undefined || rawEmail === null) {
    console.warn("[auth/email-link/send] Champ email absent");
    return jsonError(res, 400, "Email is required");
  }

  if (typeof rawEmail !== "string") {
    return jsonError(res, 400, "Email must be a string");
  }

  const email = rawEmail.trim().toLowerCase();

  if (!email) {
    return jsonError(res, 400, "Email is required");
  }

  if (!validator.isEmail(email)) {
    console.warn("[auth/email-link/send] Format email invalide");
    return jsonError(res, 400, "Invalid email address");
  }

  try {
    if (!firebaseReady) {
      console.warn("[auth/email-link/send] Firebase non initialisé");
      return jsonError(
        res,
        503,
        "Firebase Admin is not configured. Fix FIREBASE_PRIVATE_KEY (valid PEM) and restart."
      );
    }

    console.log("[auth/email-link/send] Génération du lien pour:", email);

    const signInLink = await admin.auth().generateSignInWithEmailLink(email, {
      url: CONTINUE_URL,
      handleCodeInApp: true,
      iOS: { bundleId: "com.fitscanai.labs" },
    });

    console.log("[auth/email-link/send] Lien généré, envoi Resend");

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: "Your FitScan AI sign-in link",
      html: buildSignInEmailHtml(signInLink),
    });

    if (error) {
      console.error("[resend] Erreur API:", error);
      return jsonError(res, 502, "Failed to send email");
    }

    console.log("[auth/email-link/send] Email envoyé, id:", data?.id ?? "n/a");
    return jsonOk(res);
  } catch (err) {
    console.error("[auth/email-link/send]", err.message);

    if (err.code === "auth/invalid-email") {
      return jsonError(res, 400, "Invalid email address");
    }

    return jsonError(res, 500, "Something went wrong");
  }
});

app.use((_req, res) => {
  jsonError(res, 404, "Not found");
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Écoute sur 0.0.0.0:${PORT}`);
  console.log("[server] POST /auth/email-link/send");
});

server.on("error", (err) => {
  console.error("[server] Démarrage impossible:", err.message);
  process.exit(1);
});
