import { NavLink, Outlet } from 'react-router'
import { useAuth, useAuthActions } from '@/shared/auth/AuthContext'
import { useTheme } from '@/shared/theme/ThemeContext'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/properties', label: 'Properties' },
  { to: '/leads', label: 'Leads' },
  { to: '/visits', label: 'Agenda' },
]

export function Layout() {
  const auth = useAuth()
  const { logout } = useAuthActions()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span aria-hidden="true" className={styles.logo}>
            ◆
          </span>
          Leaseflow
        </span>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          {auth.user && <span className={styles.user}>{auth.user.first_name || auth.user.username}</span>}
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
