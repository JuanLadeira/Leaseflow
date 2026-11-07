import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Bot, CalendarCheck, LogIn, MessagesSquare, Sparkles } from 'lucide-react'
import { z } from 'zod'
import { API_URL } from '@/shared/api/config'
import { useAuth, useAuthActions } from '@/shared/auth/AuthContext'
import { Logo } from '@/shared/ui/Logo'
import styles from './LoginPage.module.css'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type LoginValues = z.infer<typeof loginSchema>

const DEMO = { username: 'demo', password: 'leaseflow123' } as const
/** After this long a sign-in is probably waiting on a sleeping free-tier server. */
const SLOW_MS = 3000

const FEATURES = [
  { icon: MessagesSquare, text: 'One inbox for every lead, from Zillow to walk-ins' },
  { icon: Bot, text: 'AI drafts replies with the unit, rent and availability' },
  { icon: CalendarCheck, text: 'Book tours without double-booking a unit or agent' },
]

function errorMessage(error: unknown) {
  const status = (error as { status?: number | string } | null)?.status
  if (status === 401 || status === 400) return 'Invalid username or password.'
  return 'Could not reach the server. Please try again in a moment.'
}

export default function LoginPage() {
  const auth = useAuth()
  const { login } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [slow, setSlow] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched' })

  // Wake the API as soon as the page opens: free hosting sleeps when idle, and
  // this way the cold start overlaps with the user typing.
  useEffect(() => {
    fetch(`${API_URL}/health`).catch(() => {})
  }, [])

  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [pending])

  if (auth.status === 'authenticated') return <Navigate to={from} replace />

  async function signIn({ username, password }: LoginValues) {
    setServerError(null)
    setPending(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (error) {
      setServerError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  const onSubmit = handleSubmit(signIn)

  return (
    <main className={styles.page}>
      <section className={styles.pitch} aria-label="About Leaseflow">
        <Logo size="lg" />
        <div className={styles.pitchBody}>
          <p className={styles.eyebrow}>
            <Sparkles aria-hidden="true" className="icon" /> Leasing, on autopilot
          </p>
          <p className={styles.headline}>Turn every rental inquiry into a signed lease.</p>
          <ul className={styles.features}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.formSide}>
        <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
          <div className={styles.mobileLogo}>
            <Logo />
          </div>
          <div>
            <h1 className={styles.title}>
              <span className="visually-hidden">Leaseflow: </span>Welcome back
            </h1>
            <p className={styles.subtitle}>Sign in to manage properties and leads.</p>
          </div>

          <button
            type="button"
            className={`btn ${styles.demo}`}
            disabled={pending}
            onClick={() => signIn(DEMO)}
          >
            <LogIn aria-hidden="true" />
            Explore with the demo account
          </button>
          <p className={styles.divider}>
            <span>or sign in</span>
          </p>

          {serverError && (
            <p role="alert" className={styles.alert}>
              {serverError}
            </p>
          )}

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              aria-invalid={errors.username ? 'true' : 'false'}
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
            />
            {errors.username && (
              <span id="username-error" className="field-error">
                {errors.username.message}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <span id="password-error" className="field-error">
                {errors.password.message}
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className={styles.status} aria-live="polite">
            {slow
              ? 'Waking up the demo server. Free hosting sleeps when idle, so the first sign-in can take up to a minute.'
              : ''}
          </p>
          <p className={styles.hint}>
            Demo account: <code>demo</code> / <code>leaseflow123</code>
          </p>
        </form>
      </div>
    </main>
  )
}
