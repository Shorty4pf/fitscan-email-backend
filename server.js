require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const PORT = Number(process.env.PORT) || 3000;

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

/** TEMPORAIRE — remplacer par la route Firebase + Resend une fois le diagnostic terminé */
app.post("/auth/email-link/send", (req, res) => {
  console.log("ROUTE HIT", req.body);
  return res.status(200).json({
    ok: true,
    step: "route reached",
  });
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
