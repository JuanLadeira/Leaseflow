import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { AuthProvider } from '@/shared/auth/AuthContext'
import { ThemeProvider } from '@/shared/theme/ThemeContext'
import { ToastProvider } from '@/shared/ui/Toast'
import type { AppStore } from './store'

/** All app-wide providers in one place, reused by main.tsx and the test utils. */
export function AppProviders({ store, children }: { store: AppStore; children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  )
}
