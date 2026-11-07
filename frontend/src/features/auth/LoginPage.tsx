import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { useAuth, useAuthActions } from '@/shared/auth/AuthContext'
import styles from './LoginPage.module.css'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const auth = useAuth()
  const { login } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched' })

  if (auth.status === 'authenticated') return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setServerError(null)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch {
      setServerError('Invalid username or password.')
    }
  })

  return (
    <main className={styles.page}>
      <form className={`card ${styles.card}`} onSubmit={onSubmit} noValidate>
        <div>
          <h1 className={styles.title}>
            <span aria-hidden="true">◆ </span>Leaseflow
          </h1>
          <p className={styles.subtitle}>Sign in to manage properties and leads.</p>
        </div>

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

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className={styles.hint}>
          Demo account: <code>demo</code> / <code>leaseflow123</code>
        </p>
      </form>
    </main>
  )
}
