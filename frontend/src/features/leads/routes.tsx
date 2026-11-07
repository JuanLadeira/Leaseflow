import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const LeadsInboxPage = lazy(() => import('./LeadsInboxPage'))
const LeadDetailPage = lazy(() => import('./LeadDetailPage'))
const NoLeadSelected = lazy(() =>
  import('./LeadsInboxPage').then((module) => ({ default: module.NoLeadSelected })),
)

/** Nested routes: the inbox list stays mounted while the detail pane changes. */
export const leadsRoutes: RouteObject[] = [
  {
    path: 'leads',
    element: <LeadsInboxPage />,
    children: [
      { index: true, element: <NoLeadSelected /> },
      { path: ':leadId', element: <LeadDetailPage /> },
    ],
  },
]
