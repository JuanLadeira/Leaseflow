import type { TokenPair } from '@/shared/api/types'

/**
 * Tiny external store for the JWT pair.
 *
 * Lives outside React so RTK Query's baseQuery (not a component) can read and
 * refresh tokens, while components subscribe through `useSyncExternalStore`.
 */
const ACCESS_KEY = 'leaseflow.access'
const REFRESH_KEY = 'leaseflow.refresh'

type Listener = () => void
const listeners = new Set<Listener>()

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

export const tokenStorage = {
  getAccess: () => read(ACCESS_KEY),
  getRefresh: () => read(REFRESH_KEY),
  set(tokens: TokenPair) {
    localStorage.setItem(ACCESS_KEY, tokens.access)
    localStorage.setItem(REFRESH_KEY, tokens.refresh)
    emit()
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    emit()
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
