import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { API, leadDetail } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('Leads inbox', () => {
  it('virtualizes a long list: 300 leads, only a window of rows in the DOM', async () => {
    renderApp('/leads')
    const list = await screen.findByRole('list', { name: 'Leads' })
    const rows = within(list).getAllByRole('listitem')
    expect(screen.getByText('(300)')).toBeInTheDocument()
    expect(rows.length).toBeLessThan(30)
    expect(rows[0]).toHaveAttribute('aria-setsize', '300')
  })

  it('filters by status through the URL', async () => {
    const { user, router } = renderApp('/leads')
    await screen.findByText('(300)')
    await user.click(screen.getByRole('button', { name: 'New' }))
    expect(await screen.findByText('(100)')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?status=new')
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Lead detail', () => {
  it('shows the conversation', async () => {
    renderApp('/leads/1')
    expect(await screen.findByRole('heading', { name: 'Ava Smith' })).toBeInTheDocument()
    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(within(log).getByText('Hi! Is unit 1B still available?')).toBeInTheDocument()
  })

  it('streams an AI suggestion and moves it into the reply box', async () => {
    const { user } = renderApp('/leads/1')
    await user.click(await screen.findByRole('button', { name: 'Suggest reply' }))
    await waitFor(() =>
      expect(screen.getByTestId('suggestion-text')).toHaveTextContent(
        'Hi Ava, unit 1B is available!',
      ),
    )
    expect(screen.getByText(/Drafted by test-model/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this draft' }))
    expect(screen.getByLabelText('Reply')).toHaveValue('Hi Ava, unit 1B is available!')
  })

  it('sends a reply flagged as AI-assisted', async () => {
    let sent: unknown
    server.use(
      http.post(`${API}/leads/:id/messages`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(
          { id: 5, direction: 'outbound', body: 'x', ai_generated: true, created_at: '' },
          { status: 201 },
        )
      }),
    )
    const { user } = renderApp('/leads/1')
    await user.click(await screen.findByRole('button', { name: 'Suggest reply' }))
    await user.click(await screen.findByRole('button', { name: 'Use this draft' }))
    await user.click(screen.getByRole('button', { name: 'Send reply' }))
    expect(await screen.findByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Reply sent')).toBeInTheDocument() // toast
    expect(sent).toEqual({ body: 'Hi Ava, unit 1B is available!', ai_generated: true })
    expect(screen.getByLabelText('Reply')).toHaveValue('')
  })

  it('shows a streaming error from the server', async () => {
    server.use(
      http.post(`${API}/leads/:id/reply-suggestion`, () =>
        HttpResponse.text('event: error\ndata: {"detail":"AI provider error: RateLimitError"}\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    )
    const { user } = renderApp('/leads/1')
    await user.click(await screen.findByRole('button', { name: 'Suggest reply' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('RateLimitError')
  })

  it('updates the status optimistically and rolls back on failure', async () => {
    server.use(
      http.patch(`${API}/leads/:id`, async () => {
        await delay(50)
        return HttpResponse.json({ detail: 'boom' }, { status: 500 })
      }),
    )
    const { user } = renderApp('/leads/1')
    const select = await screen.findByLabelText('Pipeline status')
    expect(select).toHaveValue(leadDetail.status)
    await user.selectOptions(select, 'tour_scheduled')
    expect(select).toHaveValue('tour_scheduled') // optimistic
    expect(await screen.findByText('Could not update the status. Reverted.')).toBeInTheDocument()
    // The alert is set inside the transition; React drops the optimistic value
    // when the transition ends, which can land a render later.
    await waitFor(() => expect(select).toHaveValue('new')) // rolled back
  })
})
