import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '@/shared/ui/Spinner'
import { useAuth } from './AuthContext'

/** Layout route guard: renders child routes only for signed-in users. */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageSpinner label="Restoring your session" />
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
