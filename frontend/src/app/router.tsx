import { Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import { authRoutes } from '@/features/auth'
import { dashboardRoutes } from '@/features/dashboard'
import { leadsRoutes } from '@/features/leads'
import { propertiesRoutes } from '@/features/properties'
import { visitsRoutes } from '@/features/visits'
import { RequireAuth } from '@/shared/auth/RequireAuth'
import { FullPageSpinner } from '@/shared/ui/Spinner'
import { Layout } from './Layout'

/** The app only composes feature routes; each feature owns its own pages. */
export const routes: RouteObject[] = [
  {
    element: (
      <Suspense fallback={<FullPageSpinner />}>
        <Outlet />
      </Suspense>
    ),
    children: [
      ...authRoutes,
      {
        element: <RequireAuth />,
        children: [
          {
            element: <Layout />,
            children: [...dashboardRoutes, ...propertiesRoutes, ...leadsRoutes, ...visitsRoutes],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
