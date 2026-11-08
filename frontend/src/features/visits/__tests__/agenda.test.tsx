import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { API, makeVisit, tomorrowAt } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import { formatDay, startOfWeek, toDateKey } from '../dates'

const tomorrow = tomorrowAt(0)
const week = toDateKey(startOfWeek(tomorrow))
const toursTomorrow = () => screen.findByRole('list', { name: `Tours on ${formatDay(tomorrow)}` })

async function openFormForAva() {
  const app = renderApp(`/visits?week=${week}&schedule=1&lead=1`)
  await screen.findByRole('heading', { name: 'Schedule a tour' })
  expect(screen.getByText('Ava Smith')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: toDateKey(tomorrow) } })
  return app
}

describe('Agenda', () => {
  it('shows the week of tours from the URL', async () => {
    renderApp(`/visits?week=${week}`)
    const list = await toursTomorrow()
    expect(within(list).getByRole('link', { name: 'Leo King' })).toHaveAttribute('href', '/leads/2')
    expect(screen.getByText(/1 tour$/)).toBeInTheDocument()
  })

  it('disables slots where the unit is already booked', async () => {
    await openFormForAva()
    expect(await screen.findByRole('button', { name: '10:00 AM (unit booked)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '10:30 AM' })).toBeEnabled()
    // A 60-minute tour starting at 9:30 would run into the 10:00 visit.
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '60' } })
    expect(screen.getByRole('button', { name: '9:30 AM (unit booked)' })).toBeDisabled()
  })

  it('books a tour: optimistic card first, then the saved one', async () => {
    let sent: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/visits`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        await delay(50)
        return HttpResponse.json(
          makeVisit({ id: 777, lead_id: 1, lead_name: 'Ava Smith', start: tomorrowAt(11) }),
          { status: 201 },
        )
      }),
    )
    const { user, router } = await openFormForAva()
    await user.click(await screen.findByRole('button', { name: '11:00 AM' }))
    await user.type(screen.getByLabelText('Notes'), 'Bringing a co-signer')
    await user.click(screen.getByRole('button', { name: 'Book tour' }))

    expect(await screen.findByText('Booking…', { selector: 'span' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Schedule a tour' })).toBeNull())
    const list = await toursTomorrow()
    expect(within(list).getByRole('link', { name: 'Ava Smith' })).toBeInTheDocument()
    expect(within(list).queryByText('Booking…')).toBeNull()
    expect(sent).toMatchObject({ lead_id: 1, unit_id: 7, notes: 'Bringing a co-signer' })
    expect(sent?.starts_at).toBe(tomorrowAt(11).toISOString())
    expect(router.state.location.search).toBe(`?week=${week}`)
  })

  it('shows the server conflict and clears the slot when it was just taken', async () => {
    server.use(
      http.post(`${API}/visits`, () =>
        HttpResponse.json(
          { detail: '1B at Maple Court already has a visit with Leo King.', conflict: null },
          { status: 409 },
        ),
      ),
    )
    const { user } = await openFormForAva()
    const slot = await screen.findByRole('button', { name: '11:00 AM' })
    await user.click(slot)
    expect(slot).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Book tour' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already has a visit')
    expect(screen.getByRole('button', { name: '11:00 AM' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('asks for a slot before submitting', async () => {
    const { user } = await openFormForAva()
    await user.click(screen.getByRole('button', { name: 'Book tour' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick a time slot.')
  })

  it('cancels optimistically and restores the tour when the server fails', async () => {
    server.use(
      http.patch(`${API}/visits/:id`, async () => {
        await delay(50)
        return HttpResponse.json({ detail: 'boom' }, { status: 500 })
      }),
    )
    const { user } = renderApp(`/visits?week=${week}`)
    const list = await toursTomorrow()
    await user.click(within(list).getByRole('button', { name: /Cancel tour with Leo King/ }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Leo King' })).toBeNull())
    expect(await screen.findByRole('alert')).toHaveTextContent("It's back on the agenda")
    expect(await screen.findByRole('link', { name: 'Leo King' })).toBeInTheDocument()
  })

  it('removes a canceled tour', async () => {
    const { user } = renderApp(`/visits?week=${week}`)
    const list = await toursTomorrow()
    await user.click(within(list).getByRole('button', { name: /Cancel tour with Leo King/ }))
    await waitFor(() => expect(screen.getByText(/0 tours$/)).toBeInTheDocument())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Lead page', () => {
  it('links to the booking form with the lead pre-selected', async () => {
    renderApp('/leads/1')
    const link = await screen.findByRole('link', { name: 'Schedule tour' })
    expect(link).toHaveAttribute('href', '/visits?schedule=1&lead=1')
  })
})

describe('Agenda empty week', () => {
  it('points to the next booked tour and jumps to its week', async () => {
    const later = tomorrowAt(10)
    later.setDate(later.getDate() + 21)
    const shownWeek = startOfWeek(new Date())
    server.use(
      http.get(`${API}/visits`, ({ request }) => {
        const start = new Date(new URL(request.url).searchParams.get('start')!)
        // The shown week is empty; the look-ahead range (which starts after it) finds a
        // tour three weeks out. Compared to the shown week, not to "tomorrow": on the last
        // day of a week the look-ahead starts tomorrow at midnight.
        return HttpResponse.json(start > shownWeek ? [makeVisit({ start: later })] : [])
      }),
    )
    const { user, router } = renderApp(`/visits?week=${toDateKey(shownWeek)}`)
    expect(await screen.findByText('No tours this week.')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Go to that week' }))
    expect(router.state.location.search).toContain(`week=${toDateKey(startOfWeek(later))}`)
  })
})
