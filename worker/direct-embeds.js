import links from './embed-links.js';

export function directServers(id, episode) {
  return links[String(id)]?.[String(episode)]?.servers ?? null;
}

// Use metadata endpoints only: known embeds never require a reanime lookup.
export async function directWatch(id, episode, origin, mappedServers) {
  const read = async path => {
    const response = await fetch(new URL(path, origin), {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000), redirect: 'manual',
    });
    if (!response.ok) throw new Error(`Metadata unavailable (${response.status})`);
    return response.json();
  };
  const [anime, episodes] = await Promise.all([
    read(`/api/anime/${id}`), read(`/api/anime/${id}/episodes`),
  ]);
  const servers = mappedServers ?? directServers(id, episode);
  return {
    anime, episode: episodes.data.find(e => e.episode_number === episode) ?? { episode_number: episode },
    prev_episode: episode > 1 ? episode - 1 : null,
    next_episode: episode < episodes.total ? episode + 1 : null,
    available: servers.sub.length + servers.dub.length > 0,
    servers, server_source: 'verified-embed-map',
  };
}

export async function storedServers(id, episode, siteOrigin) {
  try {
    const response = await fetch(new URL('/embeds/' + Number(id) + '.json', siteOrigin), { signal: AbortSignal.timeout(5000) });
    if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
      const map = await response.json();
      if (map[String(episode)]?.servers) return map[String(episode)].servers;
    }
  } catch { /* Missing static mapping uses the seed or existing provider flow. */ }
  return directServers(id, episode);
}
