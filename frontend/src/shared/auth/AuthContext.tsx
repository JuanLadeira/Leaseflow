import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import { createContext, use, useSyncExternalStore, type ReactNode } from 'react'
import { useDispatch } from 'react-redux'
import { authApi, useLoginMutation, useMeQuery } from '@/shared/auth/authApi'
import { baseApi } from '@/shared/api/baseApi'
import type { User } from '@/shared/api/types'
import { tokenStorage } from './tokenStorage'

/**
 * Auth is split into two contexts on purpose:
 *  - AuthStateContext changes when the session changes (user, status)
 *  - AuthActionsContext is stable, so components that only call login/logout
 *    (forms, buttons) never re-render when the user object changes.
 */
export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null }

interface AuthActions {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthStateContext = createContext<AuthState | null>(null)
const AuthActionsContext = createContext<AuthActions | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // shared/ can't import app/, so type the dispatch locally (thunks are enough here).
  const dispatch = useDispatch<ThunkDispatch<unknown, unknown, UnknownAction>>()
  const token = useSyncExternalStore(tokenStorage.subscribe, tokenStorage.getAccess)
  const [loginRequest] = useLoginMutation()
  const me = useMeQuery(undefined, { skip: !token })

  let state: AuthState
  if (!token || me.isError) state = { status: 'anonymous', user: null }
  else if (me.data) state = { status: 'authenticated', user: me.data }
  else state = { status: 'loading', user: null }

  // With the React Compiler this object is memoized automatically, keeping the
  // actions context value referentially stable across renders.
  const actions: AuthActions = {
    async login(username, password) {
      const tokens = await loginRequest({ username, password }).unwrap()
      tokenStorage.set(tokens)
      await dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true }))
    },
    logout() {
      tokenStorage.clear()
      dispatch(baseApi.util.resetApiState())
    },
  }

  return (
    <AuthActionsContext value={actions}>
      <AuthStateContext value={state}>{children}</AuthStateContext>
    </AuthActionsContext>
  )
}

export function useAuth(): AuthState {
  const ctx = use(AuthStateContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function useAuthActions(): AuthActions {
  const ctx = use(AuthActionsContext)
  if (!ctx) throw new Error('useAuthActions must be used inside <AuthProvider>')
  return ctx
}
