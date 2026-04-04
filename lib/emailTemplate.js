/**
 * HTML email — thème sombre, bouton principal + lien texte de secours.
 * @param {string} signInUrl URL complète générée par Firebase Admin
 */
function buildSignInEmailHtml(signInUrl) {
  const safeUrl = escapeHtml(signInUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Sign in to FitScan AI</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f1117;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background-color:#1a1d26;border-radius:12px;border:1px solid #2a2f3d;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 8px 28px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#8b93a7;">FitScan AI</p>
              <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.3;color:#f4f5f7;">Sign in to your account</h1>
              <p style="margin:16px 0 0 0;font-size:15px;line-height:1.55;color:#b4bac8;">Tap the button below to open the app and finish signing in. This link expires soon for your security.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:8px;background-color:#6366f1;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#8b93a7;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:8px 0 0 0;font-size:12px;line-height:1.5;word-break:break-all;color:#a5adbd;">${safeUrl}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;border-top:1px solid #2a2f3d;">
              <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;">If you did not request this email, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

module.exports = { buildSignInEmailHtml };
