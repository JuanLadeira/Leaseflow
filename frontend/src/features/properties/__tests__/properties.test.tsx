import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('Properties page', () => {
  it('renders property cards from the API with occupancy', async () => {
    renderApp('/properties')
    const list = await screen.findByRole('list')
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(6) // first page
    expect(within(cards[0]).getByRole('link', { name: 'Maple Court 0' })).toBeInTheDocument()
    expect(within(cards[0]).getByLabelText('Occupancy 80%')).toBeInTheDocument()
    expect(screen.getByText('8 properties in your portfolio')).toBeInTheDocument()
  })

  it('filters with a debounced search and keeps it in the URL', async () => {
    const { user, router } = renderApp('/properties')
    await screen.findAllByRole('listitem')
    await user.type(screen.getByLabelText('Search properties'), 'boston')
    expect(await screen.findByText('4 properties in your portfolio')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=boston')
  })

  it('paginates', async () => {
    const { user } = renderApp('/properties')
    await screen.findAllByRole('listitem')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Maple Court 6' })).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    server.use(http.get(`${API}/properties`, () => HttpResponse.json({}, { status: 500 })))
    renderApp('/properties')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load properties.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
