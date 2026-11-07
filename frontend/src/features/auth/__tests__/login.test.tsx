import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('Login flow', () => {
  it('redirects anonymous users from a protected page to /login', async () => {
    renderApp('/properties', { signedIn: false })
    expect(await screen.findByRole('heading', { name: /leaseflow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('validates the form before calling the API', async () => {
    const { user } = renderApp('/login', { signedIn: false })
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the server error for bad credentials', async () => {
    const { user } = renderApp('/login', { signedIn: false })
    await user.type(await screen.findByLabelText('Username'), 'demo')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
  })

  it('signs in and returns to the page the user asked for', async () => {
    const { user, router } = renderApp('/properties', { signedIn: false })
    await user.type(await screen.findByLabelText('Username'), 'demo')
    await user.type(screen.getByLabelText('Password'), 'leaseflow123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Properties' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/properties')
    expect(localStorage.getItem('leaseflow.access')).toBe('access-token')
  })

  it('signs in with one click using the demo account', async () => {
    const { user, router } = renderApp('/login', { signedIn: false })
    await user.click(await screen.findByRole('button', { name: /demo account/i }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('tells a server outage apart from bad credentials', async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({}, { status: 503 })))
    const { user } = renderApp('/login', { signedIn: false })
    await user.click(await screen.findByRole('button', { name: /demo account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })

  it('signs out and clears the session', async () => {
    const { user } = renderApp('/properties')
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(localStorage.getItem('leaseflow.access')).toBeNull()
  })
})
