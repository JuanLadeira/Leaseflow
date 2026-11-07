import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const LoginPage = lazy(() => import('./LoginPage'))

/** Public routes (rendered outside the authenticated layout). */
export const authRoutes: RouteObject[] = [{ path: 'login', element: <LoginPage /> }]
