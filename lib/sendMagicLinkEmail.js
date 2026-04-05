const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/**
 * POST /emails avec click_tracking / open_tracking désactivés (repli sans ces champs si l’API les refuse).
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
