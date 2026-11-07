import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '@/shared/ui/Spinner'
import { useAuth } from './AuthContext'
import { useTranslation } from 'react-i18next'

/** Layout route guard: renders child routes only for signed-in users. */
export function RequireAuth() {
  const { t } = useTranslation()
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageSpinner label={t('auth.restoring')} />
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
