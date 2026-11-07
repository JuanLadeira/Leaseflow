import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { i18n } from '@/shared/i18n'
import { server } from './server'

// Tests assert on English copy: pin the language regardless of the machine's locale.
beforeAll(async () => {
  await i18n.changeLanguage('en')
  server.listen({ onUnhandledFrame: 'error' })
})
afterEach(async () => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en')
})
afterAll(() => server.close())
