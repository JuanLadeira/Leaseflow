import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Bot, CalendarCheck, LogIn, MessagesSquare, Sparkles } from 'lucide-react'
import { z } from 'zod'
import { API_URL } from '@/shared/api/config'
import { useAuth, useAuthActions } from '@/shared/auth/AuthContext'
import { LanguageSwitcher } from '@/shared/i18n/LanguageSwitcher'
import { Logo } from '@/shared/ui/Logo'
import styles from './LoginPage.module.css'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'errors.usernameRequired'),
  password: z.string().min(8, 'errors.passwordMin'),
})
type LoginValues = z.infer<typeof loginSchema>
/** Zod messages are translation keys, resolved with t() at render time. */
type FieldErrorKey = 'errors.usernameRequired' | 'errors.passwordMin'

const DEMO = { username: 'demo', password: 'leaseflow123' } as const
/** After this long a sign-in is probably waiting on a sleeping free-tier server. */
const SLOW_MS = 3000

const FEATURES = [
  { icon: MessagesSquare, text: 'pitch.inbox' },
  { icon: Bot, text: 'pitch.ai' },
  { icon: CalendarCheck, text: 'pitch.tours' },
] as const

function errorKey(error: unknown) {
  const status = (error as { status?: number | string } | null)?.status
  if (status === 401 || status === 400) return 'errors.invalidCredentials' as const
  return 'errors.unreachable' as const
}

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const auth = useAuth()
  const { login } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [serverError, setServerError] = useState<ReturnType<typeof errorKey> | null>(null)
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
      setServerError(errorKey(error))
    } finally {
      setPending(false)
    }
  }
  const onSubmit = handleSubmit(signIn)

  return (
    <main className={styles.page}>
      <section className={styles.pitch} aria-label={t('pitch.label')}>
        <Logo size="lg" />
        <div className={styles.pitchBody}>
          <p className={styles.eyebrow}>
            <Sparkles aria-hidden="true" className="icon" /> {t('pitch.eyebrow')}
          </p>
          <p className={styles.headline}>{t('pitch.headline')}</p>
          <ul className={styles.features}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon />
                </span>
                {t(text)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.formSide}>
        <div className={styles.lang}>
          <LanguageSwitcher />
        </div>
        <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={pending}>
          <div className={styles.mobileLogo}>
            <Logo />
          </div>
          <div>
            <h1 className={styles.title}>
              <span className="visually-hidden">Leaseflow: </span>
              {t('form.title')}
            </h1>
            <p className={styles.subtitle}>{t('form.subtitle')}</p>
          </div>

          <button
            type="button"
            className={`btn ${styles.demo}`}
            disabled={pending}
            onClick={() => signIn(DEMO)}
          >
            <LogIn aria-hidden="true" />
            {t('form.demo')}
          </button>
          <p className={styles.divider}>
            <span>{t('form.or')}</span>
          </p>

          {serverError && (
            <p role="alert" className={styles.alert}>
              {t(serverError)}
            </p>
          )}

          <div className="field">
            <label htmlFor="username">{t('form.username')}</label>
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
                {t(errors.username.message as FieldErrorKey)}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">{t('form.password')}</label>
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
                {t(errors.password.message as FieldErrorKey)}
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? t('form.submitting') : t('form.submit')}
          </button>
          <p className={styles.status} aria-live="polite">
            {slow
              ? t('form.waking')
              : ''}
          </p>
          <p className={styles.hint}>
            {t('form.demoHint')} <code>demo</code> / <code>leaseflow123</code>
          </p>
        </form>
      </div>
    </main>
  )
}
