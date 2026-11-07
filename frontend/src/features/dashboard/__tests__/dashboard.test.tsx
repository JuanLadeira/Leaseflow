import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('Dashboard', () => {
  it('shows KPIs with context lines', async () => {
    renderApp('/')
    expect(await screen.findByText('82%')).toBeInTheDocument()
    expect(screen.getByText('90 of 110 units leased')).toBeInTheDocument()
    expect(screen.getByText('100 new · 200 contacted')).toBeInTheDocument()
  })

  it('lists new leads waiting for a reply, linking to their conversation', async () => {
    renderApp('/')
    const panel = await screen.findByRole('region', { name: /waiting for a reply/i })
    const first = await within(panel).findByRole('link', { name: /^Lead 1(?!\d)/ })
    expect(first).toHaveAttribute('href', '/leads/1?status=new')
    // only the five most recent are shown; the counter carries the total
    expect(within(panel).getAllByRole('listitem')).toHaveLength(5)
    expect(within(panel).getByText('100')).toBeInTheDocument()
  })

  it('shows upcoming tours from the agenda', async () => {
    renderApp('/')
    const panel = await screen.findByRole('region', { name: /upcoming tours/i })
    expect(await within(panel).findByText('Tomorrow')).toBeInTheDocument()
  })

  it('offers to schedule a tour when the week is empty', async () => {
    server.use(http.get(`${API}/visits`, () => HttpResponse.json([])))
    renderApp('/')
    const panel = await screen.findByRole('region', { name: /upcoming tours/i })
    expect(await within(panel).findByText('No tours in the next 7 days')).toBeInTheDocument()
  })
})
