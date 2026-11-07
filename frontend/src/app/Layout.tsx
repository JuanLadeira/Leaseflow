import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { useAuth, useAuthActions } from '@/shared/auth/AuthContext'
import { useTheme } from '@/shared/theme/ThemeContext'
import { LanguageSwitcher } from '@/shared/i18n/LanguageSwitcher'
import { Logo } from '@/shared/ui/Logo'
import styles from './Layout.module.css'
import { useTranslation } from 'react-i18next'

type NavItem = {
  to: string
  label: `nav.${'dashboard' | 'properties' | 'leads' | 'agenda'}`
  icon: typeof LayoutDashboard
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'nav.properties', icon: Building2 },
  { to: '/leads', label: 'nav.leads', icon: MessagesSquare },
  { to: '/visits', label: 'nav.agenda', icon: CalendarDays },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function Layout() {
  const { t } = useTranslation()
  const auth = useAuth()
  const { logout } = useAuthActions()
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  // Mobile drawer; on desktop the sidebar is always visible and this flag is ignored.
  const [navOpen, setNavOpen] = useState(false)

  // Close the drawer after navigating (adjusting state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setNavOpen(false)
  }

  useEffect(() => {
    if (!navOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const displayName = auth.user
    ? [auth.user.first_name, auth.user.last_name].filter(Boolean).join(' ') || auth.user.username
    : ''

  return (
    <div className={styles.shell} data-nav-open={navOpen ? 'true' : 'false'}>
      <a href="#main" className="skip-link">
        {t('nav.skip')}
      </a>

      <header className={styles.topbar}>
        <button
          type="button"
          className="btn btn-ghost"
          aria-label={t('nav.open')}
          aria-expanded={navOpen}
          aria-controls="sidebar"
          onClick={() => setNavOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
        <Logo />
      </header>

      <div className={styles.backdrop} aria-hidden="true" onClick={() => setNavOpen(false)} />

      <aside id="sidebar" className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <Logo />
          <button
            type="button"
            className={`btn btn-ghost ${styles.close}`}
            aria-label={t('nav.close')}
            onClick={() => setNavOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav aria-label={t('nav.main')} className={styles.nav}>
          <span className={styles.navLabel}>{t('nav.workspace')}</span>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              <Icon aria-hidden="true" className={styles.linkIcon} />
              {t(label)}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          {auth.user && (
            <div className={styles.profile}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(displayName)}
              </span>
              <span className={styles.who}>
                <span className={styles.name}>{displayName}</span>
                <span className={styles.email}>{auth.user.email || auth.user.username}</span>
              </span>
            </div>
          )}
          <div className={styles.footerActions}>
            <LanguageSwitcher />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
              title={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
            >
              {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>
            <button type="button" className="btn btn-ghost" onClick={logout} title={t('auth.signOut')}>
              <LogOut aria-hidden="true" />
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className={styles.main}>
        <div key={pathname.split('/')[1]} className="enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
