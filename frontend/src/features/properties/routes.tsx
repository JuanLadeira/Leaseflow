import { lazy } from 'react'
import type { RouteObject } from 'react-router'

// Each page is its own chunk: the browser downloads it on first navigation.
const PropertiesPage = lazy(() => import('./PropertiesPage'))
const PropertyDetailPage = lazy(() => import('./PropertyDetailPage'))

export const propertiesRoutes: RouteObject[] = [
  { path: 'properties', element: <PropertiesPage /> },
  { path: 'properties/:propertyId', element: <PropertyDetailPage /> },
]
