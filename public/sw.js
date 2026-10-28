// Push notifications. Pushes carry no payload: on each one we fetch the newest unread
// notification from the API (the session cookie is sent) and show it.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let title = 'AnimeGang', body = 'You have a new notification', url = '/'
    try {
      const res = await fetch('/api/u/notifications', { credentials: 'include' })
      const n = (await res.json()).items?.find((x) => !x.read)
      if (n?.type === 'episode') {
        const t = n.payload.title
        title = `Episode ${n.payload.episode} is out`
        body = (t && (t.english || t.romaji)) || 'A show you follow has a new episode'
        url = `/watch/${n.payload.anime_id}/${n.payload.episode}`
      } else if (n?.type === 'reply') {
        title = `${n.payload.from} replied to you`
        body = n.payload.excerpt || ''
        url = `/watch/${n.payload.anime_id}/${n.payload.episode}`
      }
    } catch { /* show the generic notification */ }
    await self.registration.showNotification(title, { body, icon: '/favicon.png', badge: '/favicon.png', data: { url } })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || '/'))
})
