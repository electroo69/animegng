// Page copy shared by the app (src/) and the edge SEO renderer (worker/seo.js), so visitors and crawlers
// read the same words: the home intro and FAQ, the trust pages, and the per-anime FAQ.

export const CONTACT_EMAIL = 'support@animegng.com';

export const HOME_HEADING = 'Watch Anime Online Free';
export const HOME_INTRO = 'AnimeGang is a free site to watch anime online in HD with English sub and dub. Pick from thousands of series and movies, follow new episodes as they air, and start watching without an account.';

export const HOME_FAQ = [
  ['What is AnimeGang?', 'AnimeGang is a free anime streaming site. You can watch anime online in HD with English subtitles or English dub, browse by genre, season and rating, and check the weekly airing schedule.'],
  ['Is it free to watch anime on AnimeGang?', 'Yes. Every series and movie is free to watch. There is no subscription and no payment details are ever asked for.'],
  ['Do I need an account to watch anime?', 'No. You can watch without signing up. A free account is optional: it syncs your watch history between devices and adds playlists, new-episode notifications and watch parties.'],
  ['Can I watch anime with English sub and English dub?', 'Yes. Nearly every episode has English subtitles, and an English dub is available wherever one has been released. Switch between them with the AG (sub) and AG-DUB (dub) server buttons under the player.'],
  ['How soon are new episodes added?', 'New episodes are added shortly after they air in Japan. The schedule page shows this week’s episodes with air times in your own time zone.'],
  ['Can I watch anime free on my phone?', 'Yes. AnimeGang works in the browser on phones, tablets, laptops and desktops. There is no app to install.'],
  ['What anime can I watch online here?', 'Thousands of titles, from long-running series such as One Piece, Naruto and Bleach to this season’s new anime, plus anime movies. Use the genre, season and top-rated pages to find something to watch.'],
  ['What should I do if a video does not load?', 'Pick another server under the player. If a server is slow on the first try, AnimeGang switches to the next one automatically.'],
];

// Trust pages: /about, /contact, /dmca, /terms. Each section is [heading, ...paragraphs].
export const LEGAL = {
  about: {
    title: 'About AnimeGang',
    description: 'What AnimeGang is, where its anime data comes from and how to get in touch.',
    sections: [
      ['What AnimeGang is', 'AnimeGang is a free anime streaming and discovery site, run as an independent side project. It lets you watch anime online with English sub and dub, follow the airing schedule and keep track of what you watch.'],
      ['Where the information comes from', 'Titles, synopses, episode lists, air dates, characters and scores come from AniList and ani.zip. AnimeGang does not store video files on its servers: episodes are played from third-party video hosts.'],
      ['Get in touch', `Questions, bug reports and feedback are welcome at ${CONTACT_EMAIL}. Copyright owners can use the DMCA page.`],
    ],
  },
  contact: {
    title: 'Contact AnimeGang',
    description: 'How to reach AnimeGang for support, feedback, and copyright or removal requests.',
    sections: [
      ['Email', `Write to ${CONTACT_EMAIL}. We read every message and usually reply within a few days.`],
      ['What to include', 'For a playback problem, tell us the anime, the episode number, the server you used and your device and browser. For an account problem, include your username.'],
      ['Copyright and removal requests', 'If you own the rights to something linked from AnimeGang, please follow the steps on the DMCA page so we can act on it quickly.'],
    ],
  },
  dmca: {
    title: 'DMCA & Copyright Policy',
    description: 'How copyright owners can ask AnimeGang to remove a page, and what a takedown notice needs to include.',
    sections: [
      ['Our policy', 'AnimeGang respects the rights of copyright owners. AnimeGang does not store video files on its servers; episodes are played from third-party video hosts. When a rights holder tells us about a page, we review the notice and remove the reported pages promptly.'],
      ['How to send a notice', `Email ${CONTACT_EMAIL} with the subject "DMCA notice". Sending the notice to us directly is the fastest way to get a page removed.`],
      ['What the notice must include',
        '1. The copyrighted work you own or represent (title, and a link to the official source if there is one).',
        '2. The exact AnimeGang URLs you want removed.',
        '3. Your name, organisation, and an email address where we can reach you.',
        '4. A statement that you believe in good faith that the use is not authorised by the copyright owner, its agent or the law.',
        '5. A statement that the information in the notice is accurate and, under penalty of perjury, that you are the owner or are authorised to act for the owner.',
        '6. Your physical or electronic signature.'],
      ['What happens next', 'We remove the reported pages, make them return "410 Gone" so search engines drop them, and reply to confirm. Titles removed this way are not added back.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'The rules for using AnimeGang: accounts, comments, acceptable use and disclaimers.',
    sections: [
      ['Using the site', 'AnimeGang is free to use for personal, non-commercial viewing. Do not scrape the site at a rate that harms it, attack it, or try to get into other people’s accounts.'],
      ['Accounts', 'An account is optional. You are responsible for keeping your password safe and for what is done with your account. You can delete your account and its data at any time in Settings.'],
      ['Comments and watch parties', 'Be civil. No harassment, hate speech, spam, spoilers without warning, or illegal content. We may remove comments and suspend accounts that break these rules.'],
      ['Content and third parties', 'Anime information comes from AniList and ani.zip. Videos are played from third-party hosts that AnimeGang does not control, so availability can change without notice. Copyright owners can ask for removal on the DMCA page.'],
      ['No warranty', 'The site is provided as is, without any guarantee that it will be available, accurate or free of errors. Use it at your own risk.'],
      ['Changes', 'These terms may be updated. Continuing to use the site after a change means you accept the new terms.'],
    ],
  },
};

const FORMAT = { TV: 'TV series', TV_SHORT: 'TV short', MOVIE: 'movie', SPECIAL: 'special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'music video' };
const nameOf = (t) => t?.english || t?.user_preferred || t?.romaji || t?.native || 'Untitled';
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * Questions people search about one anime, answered only from its own data. `released` is the number of
 * episodes out so far. Returns [] when there is too little data for a useful FAQ.
 */
export function animeFaq(a, released) {
  const t = nameOf(a.title);
  const movie = a.format === 'MOVIE';
  const out = [];
  if (!movie && (a.episodes || released)) {
    out.push([`How many episodes does ${t} have?`, a.episodes
      ? `${t} has ${a.episodes} episode${a.episodes === 1 ? '' : 's'}${a.duration ? `, each about ${a.duration} minutes long` : ''}.${a.status === 'RELEASING' && released ? ` ${released} ${released === 1 ? 'is' : 'are'} out so far.` : ''}`
      : `${released} episode${released === 1 ? '' : 's'} of ${t} ${released === 1 ? 'is' : 'are'} out so far, and the final count has not been announced.`]);
  }
  if (movie && a.duration) out.push([`How long is ${t}?`, `${t} runs for about ${a.duration} minutes.`]);
  if (a.next_airing_episode) {
    out.push([`When does the next episode of ${t} come out?`, `Episode ${a.next_airing_episode.episode} of ${t} airs on ${day(a.next_airing_episode.airing_at)}.`]);
  } else if (a.status === 'FINISHED' && !movie) {
    out.push([`Is ${t} finished?`, `Yes. ${t} has finished airing${a.end_date ? `; the last episode aired on ${day(a.end_date)}` : ''}.`]);
  } else if (a.status === 'NOT_YET_RELEASED') {
    out.push([`When does ${t} come out?`, a.start_date ? `${t} is scheduled to premiere on ${day(a.start_date)}.` : `${t} has not started airing yet and no date has been announced.`]);
  }
  const rel = (kind) => (a.relations || []).find((r) => r.type === 'ANIME' && r.relation_type === kind);
  const prequel = rel('PREQUEL'), sequel = rel('SEQUEL');
  if (prequel || sequel) {
    out.push([`What order should I watch ${t} in?`, [
      prequel ? `Watch ${nameOf(prequel.title)} before ${t}.` : `${t} is the first entry in its series.`,
      sequel ? `The story continues in ${nameOf(sequel.title)}.` : '',
    ].filter(Boolean).join(' ')]);
  }
  if (a.genres?.length) {
    const studio = a.studios?.find((s) => s.is_main)?.name;
    out.push([`What kind of anime is ${t}?`, `${t} is ${/^[aeiou]/i.test(a.genres[0]) ? 'an' : 'a'} ${a.genres.slice(0, 3).join(', ').toLowerCase()} ${FORMAT[a.format] || 'anime'}${studio ? ` made by ${studio}` : ''}${a.average_score ? `, rated ${(a.average_score / 10).toFixed(1)} out of 10 on AniList` : ''}.`]);
  }
  out.push([`Where can I watch ${t} online for free?`, `You can watch ${t} free on AnimeGang in HD with English subtitles, and with an English dub where one has been released. No account is needed.`]);
  return out.length >= 3 ? out : [];
}
