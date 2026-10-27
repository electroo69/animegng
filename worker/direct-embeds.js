import links from './embed-links.json' with { type: 'json' };

export function directServers(id, episode) {
  return links[String(id)]?.[String(episode)]?.servers ?? null;
}

// Use metadata endpoints only: known embeds never require a reanime lookup.
export async function directWatch(id, episode, origin) {
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
  const servers = directServers(id, episode);
  return {
    anime, episode: episodes.data.find(e => e.episode_number === episode) ?? { episode_number: episode },
    prev_episode: episode > 1 ? episode - 1 : null,
    next_episode: episode < episodes.total ? episode + 1 : null,
    available: servers.sub.length + servers.dub.length > 0,
    servers, server_source: 'verified-embed-map',
  };
}
