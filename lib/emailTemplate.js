function buildSignInEmailHtml(signInLink) {
  const safeUrl = escapeHtml(signInLink);

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Connexion à votre compte</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f5f7;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e8eaef;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
            <tr>
              <td style="padding:40px 40px 8px 40px;">
                <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#6b7280;">FitScan AI</p>
                <h1 style="margin:16px 0 0 0;font-size:22px;line-height:1.35;font-weight:600;color:#111827;">Connexion à votre compte</h1>
                <p style="margin:24px 0 0 0;font-size:15px;line-height:1.65;color:#4b5563;">Bonjour,</p>
                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#4b5563;">Vous venez de demander un accès à votre compte FitScan AI. Pour poursuivre en toute simplicité, ouvrez simplement l’application depuis le bouton ci-dessous : nous vous y reconduirons pour finaliser la connexion de manière sécurisée.</p>
                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.65;color:#4b5563;">Ce lien est valable pour une durée limitée et cessera de fonctionner après expiration, afin de protéger votre compte.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 8px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#4f46e5;">
                      <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Ouvrir FitScan AI</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 36px 40px;">
                <p style="margin:0;font-size:14px;line-height:1.65;color:#6b7280;">Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail en toute tranquillité.</p>
                <p style="margin:28px 0 0 0;font-size:14px;line-height:1.6;color:#374151;">L’équipe FitScan AI</p>
                <p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid #eef0f4;font-size:12px;line-height:1.5;color:#9ca3af;">E-mail automatique de connexion sécurisé</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildSignInEmailText(signInLink) {
  const link = String(signInLink);
  return [
    "FitScan AI",
    "",
    "Connexion à votre compte",
    "",
    "Bonjour,",
    "",
    "Vous avez demandé à vous connecter à votre compte FitScan AI. Pour finaliser la connexion, ouvrez le lien suivant dans un navigateur ou suivez les instructions de votre appareil :",
    "",
    link,
    "",
    "Ce lien expire rapidement pour des raisons de sécurité. Si vous avez besoin d’un nouvel accès, vous pouvez relancer une demande depuis l’application.",
    "",
    "Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.",
    "",
    "L’équipe FitScan AI",
    "",
    "—",
    "E-mail automatique de connexion sécurisé",
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
