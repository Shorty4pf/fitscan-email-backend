const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/**
 * Envoie l’e-mail magic link via l’API Resend en demandant explicitement
 * la désactivation du suivi des clics / ouvertures (évite la réécriture des href).
 * Si l’API rejette ces champs, renvoie sans eux (comportement historique du SDK).
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.from
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} opts.text
 * @returns {Promise<{ data: object | null, error: object | null }>}
 */
async function sendMagicLinkEmail({ apiKey, from, to, subject, html, text }) {
  const toList = Array.isArray(to) ? to : [to];

  const basePayload = { from, to: toList, subject, html, text };

  const trySend = async (payload) => {
    const res = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  let { ok, status, data } = await trySend({
    ...basePayload,
    click_tracking: false,
    open_tracking: false,
  });

  if (!ok && (status === 400 || status === 422)) {
    console.warn(
      "[resend] Retrying without click_tracking/open_tracking (API may not support per-email flags)"
    );
    ({ ok, status, data } = await trySend(basePayload));
  }

  if (!ok) {
    return { data: null, error: data?.message ? data : { status, ...data } };
  }

  return { data, error: null };
}

module.exports = { sendMagicLinkEmail };
