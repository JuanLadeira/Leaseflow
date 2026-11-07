import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/router'
import { makeStore } from '@/app/store'
import { tokenStorage } from '@/shared/auth/tokenStorage'

interface Options {
  /** Start with a valid session (tokens in storage). */
  signedIn?: boolean
}

/** Renders the real route tree + providers at `path`, with an isolated store. */
export function renderApp(path: string, { signedIn = true }: Options = {}) {
  if (signedIn) tokenStorage.set({ access: 'access-token', refresh: 'refresh-token' })
  const store = makeStore()
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const result = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, store, router, user }
}
