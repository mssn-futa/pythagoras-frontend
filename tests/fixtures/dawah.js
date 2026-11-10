import { http } from 'msw'
import { ok, url } from './auth.js'

// Synthetic, test-only records shaped like the frozen D2 examples.
export const event = Object.freeze({
  id: 3,
  title: 'Friday khutbah',
  speakers: 'Guest speaker',
  category: 'jumuah',
  start_time: '2026-10-09T23:30:00Z', // 00:30 on 10 Oct in Africa/Lagos (UTC+1)
  location: 'FUTA mosque',
  summary: 'Key takeaways',
  description: 'Friday session',
  status: 'published',
})

export const audio = (id, overrides = {}) => ({
  id,
  event_id: 3,
  title: `Patience ${id}`,
  type: 'aud',
  status: 'published',
  storage_status: 'ready',
  media_url: `https://media.example.test/khutbah-${id}.mp3`,
  duration: 2100,
  event: { id: 3, title: event.title, speakers: event.speakers, category: event.category, start_time: event.start_time, summary: event.summary },
  ...overrides,
})

export const page = (results, count = results.length) => ({ count, next: null, previous: null, results })

/** Registers handlers and records every request (path, query, authorization). */
export function publicHandlers(handlers = {}) {
  const calls = []
  const seen = (request) => {
    const u = new URL(request.url)
    calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), auth: request.headers.get('authorization') })
  }
  const route = (path, fallback) =>
    http.get(url(path), ({ request, params }) => {
      seen(request)
      return (handlers[path] ?? fallback)({ request, params })
    })
  return {
    calls,
    list: [
      route('/dawah/archive/', () => ok(page([audio(8), audio(9)]))),
      route('/dawah/events/', () => ok(page([]))),
      route('/dawah/events/:id/', () => ok(event)),
      route('/dawah/events/:id/resources/', () => ok(page([audio(8)]))),
      route('/dawah/resources/:id/', () => ok(audio(8))),
    ],
  }
}
