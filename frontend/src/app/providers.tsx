import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { AuthProvider } from '@/shared/auth/AuthContext'
import { ThemeProvider } from '@/shared/theme/ThemeContext'
import type { AppStore } from './store'

/** All app-wide providers in one place, reused by main.tsx and the test utils. */
export function AppProviders({ store, children }: { store: AppStore; children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </Provider>
  )
}
