/**
 * Réécrit le lien Firebase (`__/auth/action?…`) vers la landing Universal Link
 * en conservant tous les paramètres d’authentification.
 *
 * `link` est placé en premier et contient l’URL Firebase complète.
 * Un redirect qui couperait au premier « & » brut garde ainsi oobCode, mode et apiKey.
 */

function toUniversalLinkLanding(firebaseSignInLink, landingUrl) {
  const src = new URL(String(firebaseSignInLink));
  const dst = new URL(String(landingUrl));
  const ordered = new URLSearchParams();

  if (!src.searchParams.has("link")) {
    ordered.set("link", src.toString());
  }

  src.searchParams.forEach((value, key) => {
    ordered.append(key, value);
  });

  dst.search = ordered.toString();
  if (src.hash) dst.hash = src.hash;
  return dst.toString();
}

/** Host, path et noms de query — jamais les valeurs (oobCode, apiKey, tokens). */
function describeLinkForLog(raw) {
  try {
    const url = new URL(String(raw));
    const keys = [];
    for (const key of url.searchParams.keys()) {
      if (!keys.includes(key)) keys.push(key);
    }
    return `${url.host}${url.pathname} queryKeys=${keys.join(",") || "(none)"}`;
  } catch {
    return "unparseable";
  }
}

module.exports = { toUniversalLinkLanding, describeLinkForLog };
