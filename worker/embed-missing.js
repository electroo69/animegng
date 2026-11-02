// Which embed servers (src/lib/api.ts fallbackServers) don't have an episode. These hosts answer 200 either way, so
// it's read from the page. BabaStream decides in the browser, so it can't be checked here and always stays listed.
const CHECKS = [
  { name: 'VHD-7', url: (id, ep, lang) => `https://zokoanime.video/stream/ani/${id}/${ep}/${lang}`, missing: /find anything to play/ },
  { name: 'VHD-3', url: (id, ep, lang) => `https://aniembed.se/e/${id}/${ep}?lang=${lang}`, missing: /servers:null/ },
];

// A timeout or blocked check counts as available: better a server that fails than hiding one that works.
async function isMissing(check, id, ep, lang) {
  try {
    const res = await fetch(check.url(id, ep, lang), { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://animegng.com/' }, signal: AbortSignal.timeout(4000) });
    return res.status === 404 || (res.ok && check.missing.test(await res.text()));
  } catch {
    return false;
  }
}

export async function missingEmbeds(id, ep) {
  const forLang = async (lang) => {
    const hits = await Promise.all(CHECKS.map((c) => isMissing(c, id, ep, lang)));
    return CHECKS.filter((_, i) => hits[i]).map((c) => c.name);
  };
  const [sub, dub] = await Promise.all([forLang('sub'), forLang('dub')]);
  return { sub, dub };
}
