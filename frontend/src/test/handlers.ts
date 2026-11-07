import { http, HttpResponse } from 'msw'
import { API, demoUser, leadDetail, leads, pageOf, properties } from './fixtures'

/** Default happy-path API. Tests override single endpoints with server.use(...). */
export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    if (body.username === 'demo' && body.password === 'leaseflow123') {
      return HttpResponse.json({ access: 'access-token', refresh: 'refresh-token' })
    }
    return HttpResponse.json({ detail: 'Invalid username or password.' }, { status: 401 })
  }),
  http.get(`${API}/auth/me`, ({ request }) =>
    request.headers.get('Authorization') === 'Bearer access-token'
      ? HttpResponse.json(demoUser)
      : HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 }),
  ),
  http.get(`${API}/properties`, ({ request }) => {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('page_size') ?? 6)
    const filtered = properties.filter(
      (p) => p.name.toLowerCase().includes(search) || p.city.toLowerCase().includes(search),
    )
    return HttpResponse.json(pageOf(filtered, page, pageSize))
  }),
  http.get(`${API}/leads`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    return HttpResponse.json(status ? leads.filter((l) => l.status === status) : leads)
  }),
  http.get(`${API}/leads/:id`, () => HttpResponse.json(leadDetail)),
  http.patch(`${API}/leads/:id`, async ({ request }) => {
    const { status } = (await request.json()) as { status: string }
    return HttpResponse.json({ ...leadDetail, status })
  }),
  http.post(`${API}/leads/:id/messages`, async ({ request }) => {
    const { body, ai_generated } = (await request.json()) as { body: string; ai_generated: boolean }
    return HttpResponse.json(
      { id: 99, direction: 'outbound', body, ai_generated, created_at: new Date().toISOString() },
      { status: 201 },
    )
  }),
  http.post(`${API}/leads/:id/reply-suggestion`, () => {
    const encoder = new TextEncoder()
    const frames = ['Hi Ava, ', 'unit 1B ', 'is available!']
    const stream = new ReadableStream({
      start(controller) {
        for (const text of frames) {
          controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`))
        }
        controller.enqueue(encoder.encode(`event: done\ndata: {"model":"test-model"}\n\n`))
        controller.close()
      },
    })
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  }),
]
