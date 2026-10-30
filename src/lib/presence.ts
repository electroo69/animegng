// Live visitor counts over one WebSocket per tab (worker/social/presence.js). Every visitor counts, signed in or not.
import { useSyncExternalStore } from "react"

type Counts = { n: number; e: Record<string, number> }

const KEY = "ag:cid"
const EMPTY: Counts = { n: 0, e: {} }

let counts = EMPTY
let page = ""
let ws: WebSocket | null = null
let retry = 2000
const listeners = new Set<() => void>()

function clientId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return ""
  }
}

function connect() {
  const s = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/u/presence?cid=${clientId()}`)
  ws = s
  s.onopen = () => {
    retry = 2000
    s.send(JSON.stringify({ p: page }))
  }
  s.onmessage = (e) => {
    try {
      counts = JSON.parse(e.data)
      listeners.forEach((l) => l())
    } catch {
      // ignore
    }
  }
  s.onclose = () => {
    ws = null
    // Jittered, so a deploy doesn't bring every tab back in the same second.
    setTimeout(connect, retry + Math.random() * 2000)
    retry = Math.min(retry * 2, 60_000)
  }
}

let started = false
// page: "anime:episode" while watching, "" anywhere else.
export function setPresencePage(next: string) {
  if (next !== page) counts = { ...counts, e: {} }
  page = next
  if (!started) {
    started = true
    // Not needed for first paint, so it waits until the page has settled.
    setTimeout(connect, 1500)
  } else if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ p: page }))
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const usePresence = () => useSyncExternalStore(subscribe, () => counts)
