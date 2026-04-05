/**
 * HTML e-mail (FR) — thème sombre, bouton uniquement (pas d’URL brute sous le bouton).
 * @param {string} signInUrl URL générée par Firebase Admin
 */
function buildSignInEmailHtml(signInUrl) {
  const safeUrl = escapeHtml(signInUrl);

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>Connectez-vous à FitScan AI</title>
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
              <td style="padding:32px 28px 20px 28px;">
                <p
                  style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8b93a7;"
                >
                  FitScan AI
                </p>

                <h1 style="margin:14px 0 0 0;font-size:24px;line-height:1.25;color:#f4f5f7;font-weight:700;">
                  Connectez-vous à FitScan AI
                </h1>

                <p style="margin:18px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Bonjour,
                </p>

                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Vous avez demandé à vous connecter à votre compte FitScan AI.
                </p>

                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Appuyez sur le bouton ci-dessous pour ouvrir l’application et terminer la connexion.
                </p>

                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#b4bac8;">
                  Ce lien est sécurisé et expirera rapidement.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 28px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#6366f1;">
                      <a
                        href="${safeUrl}"
                        style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                      >
                        Se connecter
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Version texte : lien présent pour clients sans HTML. */
function buildSignInEmailText(signInUrl) {
  return [
    "Sign in to FitScan AI",
    "",
    "Tap the button in the HTML version of this email to finish signing in.",
    "",
    signInUrl,
    "",
    "If you didn't request this email, you can safely ignore it.",
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
