import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const AgendaPage = lazy(() => import('./AgendaPage'))

export const visitsRoutes: RouteObject[] = [{ path: 'visits', element: <AgendaPage /> }]
