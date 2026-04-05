#!/usr/bin/env node
/**
 * Vérifie le JSON compte de service Firebase (PEM) sans afficher la clé.
 * Usage : node scripts/verify-credentials.js [chemin/vers/fichier.json]
 * Sans argument : premier *firebase-adminsdk*.json à la racine du projet.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function findDefaultJson(root) {
  const names = fs.readdirSync(root);
  const hit = names.find(
    (n) => n.endsWith(".json") && n.includes("firebase-adminsdk") && !n.startsWith("package")
  );
  return hit ? path.join(root, hit) : null;
}

function normalizePk(pk) {
  let s = String(pk).trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (s.includes("\\n")) {
    s = s.replace(/\\n/g, "\n");
  }
  return s;
}

const root = path.join(__dirname, "..");
const arg = process.argv[2];
const file = arg ? path.resolve(arg) : findDefaultJson(root);

if (!file || !fs.existsSync(file)) {
  console.error("Aucun fichier trouvé. Usage:");
  console.error("  node scripts/verify-credentials.js");
  console.error("  node scripts/verify-credentials.js ./fit-scan-ai-firebase-adminsdk-....json");
  process.exit(1);
}

let sa;
try {
  sa = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error("JSON invalide:", e.message);
  process.exit(1);
}

const need = ["type", "project_id", "private_key", "client_email"];
for (const k of need) {
  if (!sa[k]) {
    console.error(`Champ manquant dans le JSON: ${k}`);
    process.exit(1);
  }
}
if (sa.type !== "service_account") {
  console.error('Attendu type "service_account", reçu:', sa.type);
  process.exit(1);
}

const pk = normalizePk(sa.private_key);
if (!pk.includes("BEGIN PRIVATE KEY") && !pk.includes("BEGIN RSA PRIVATE KEY")) {
  console.error("private_key ne ressemble pas à un PEM (BEGIN … KEY manquant).");
  process.exit(1);
}

try {
  crypto.createPrivateKey({ key: pk, format: "pem" });
} catch (e) {
  console.error("OpenSSL refuse ce PEM:", e.message);
  console.error("→ Régénère une nouvelle clé dans Firebase et retélécharge le JSON.");
  process.exit(1);
}

const b64 = Buffer.from(fs.readFileSync(file, "utf8"), "utf8").toString("base64");
console.log("OK — Fichier:", path.basename(file));
console.log("    project_id:", sa.project_id);
console.log("    client_email:", sa.client_email);
console.log("    PEM reconnu par Node (crypto.createPrivateKey).");
console.log("");
console.log("Pour Railway, une seule ligne (ne colle rien avant/après) :");
console.log("  base64 -i \"" + file + "\" | tr -d '\\n'");
console.log("");
console.log("Longueur base64:", b64.length, "caractères (indicatif)");
