# FitScan AI — backend email link

API minimale : génère un lien de connexion Firebase (Admin SDK) et l’envoie avec **Resend**.

## Prérequis

- Node.js 18+
- Compte [Resend](https://resend.com) (domaine `fitscanai.app` vérifié pour `noreply@fitscanai.app`)
- Projet Firebase + compte de service (JSON)

## Installation

```bash
cp .env.example .env
# Renseigner .env (voir ci-dessous)
npm install
npm start
```

Le serveur écoute sur le port **3000** par défaut (`PORT` dans `.env` pour changer).

## Variables `.env`

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Clé API Resend |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `FIREBASE_CLIENT_EMAIL` | `client_email` du JSON du compte de service |
| `FIREBASE_PRIVATE_KEY` | `private_key` du JSON, avec `\n` pour les retours à la ligne |
| `PORT` | (optionnel) port HTTP |
| `CORS_ORIGIN` | (optionnel) `*` ou liste d’origines séparées par des virgules |

**Firebase — clé privée :** dans le JSON, la clé est multilignes. Dans `.env`, mettez-la entre guillemets et remplacez les vrais sauts de ligne par la séquence `\n`.

**Firebase Console :** ajoutez `https://fit-scan-ai.firebaseapp.com` (et votre domaine de continuation) dans **Authentication → Settings → Authorized domains** si nécessaire.

## Endpoints

- `GET /health` — statut du service  
- `POST /auth/email-link/send` — corps JSON `{ "email": "user@example.com" }`  
  - Succès : `{ "ok": true }`  
  - Erreur : `{ "ok": false, "error": "message" }`

## Test rapide (serveur déjà démarré)

```bash
curl -s -X POST http://127.0.0.1:3000/auth/email-link/send \
  -H "Content-Type: application/json" \
  -d '{"email":"vous@example.com"}'
```

```bash
npm run test:internal
```
