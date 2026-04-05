/**
 * E-mails de connexion (magic link) — HTML + texte, ton professionnel FR.
 * Le lien n’apparaît pas en clair dans le HTML (bouton uniquement).
 * @param {string} signInLink URL générée par Firebase Admin
 */
function buildSignInEmailHtml(signInLink) {
  const safeUrl = escapeHtml(signInLink);

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>Connexion à FitScan AI</title>
  </head>
  <body
    style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background-color:#0f1117;padding:32px 16px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="max-width:520px;background-color:#1a1d26;border-radius:12px;border:1px solid #2a2f3d;overflow:hidden;"
          >
            <tr>
              <td style="padding:32px 28px 8px 28px;">
                <p
                  style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8b93a7;"
                >
                  FitScan AI
                </p>
                <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;color:#f4f5f7;font-weight:700;">
                  Finaliser votre connexion
                </h1>
                <p style="margin:20px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Bonjour,
                </p>
                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Nous avons bien reçu une demande de connexion à votre compte FitScan AI. Si c’est bien vous, il vous suffit d’ouvrir l’application depuis le bouton ci-dessous pour confirmer votre identité et accéder à vos données en toute sécurité.
                </p>
                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Pour des raisons de sécurité, ce lien de connexion est personnel, à usage unique, et cessera de fonctionner après une courte période. Si le bouton n’est plus actif, vous pouvez simplement relancer une nouvelle demande depuis l’application.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#6366f1;">
                      <a
                        href="${safeUrl}"
                        style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                      >
                        Ouvrir FitScan AI et me connecter
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 28px 28px;border-top:1px solid #2a2f3d;">
                <p style="margin:16px 0 0 0;font-size:14px;line-height:1.65;color:#9aa3b2;">
                  Si vous n’avez pas initié cette demande, vous pouvez ignorer ce message en toute tranquillité : aucun accès ne sera accordé sans action de votre part.
                </p>
                <p style="margin:18px 0 0 0;font-size:14px;line-height:1.65;color:#b4bac8;">
                  Cordialement,<br />
                  <span style="font-weight:600;color:#e8eaef;">L’équipe FitScan AI</span>
                </p>
                <p style="margin:12px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;">
                  FitScan AI — assistance liée à votre compte via l’application officielle.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Version texte : contexte + lien explicite (clients sans HTML, accessibilité).
 */
function buildSignInEmailText(signInLink) {
  const link = String(signInLink);
  return [
    "FitScan AI — Connexion à votre compte",
    "",
    "Bonjour,",
    "",
    "Nous avons enregistré une demande de connexion à votre compte FitScan AI. Si c’est bien vous, ouvrez le lien ci-dessous pour finaliser la connexion dans l’application :",
    "",
    link,
    "",
    "Ce lien est personnel, à usage unique, et expire après une courte période pour protéger votre compte. S’il a expiré, demandez un nouvel e-mail de connexion depuis l’application.",
    "",
    "Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message : aucun accès ne sera accordé sans votre action.",
    "",
    "Cordialement,",
    "L’équipe FitScan AI",
    "",
    "—",
    "FitScan AI",
  ].join("\n");
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

module.exports = { buildSignInEmailHtml, buildSignInEmailText };
