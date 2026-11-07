import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { i18n } from '@/app/i18n'
import { server } from './server'

// The first test in a file pays for loading its lazy route; under coverage on a CI runner
// that can pass the 1s default of findBy*/waitFor. Real waits still resolve as soon as they can.
configure({ asyncUtilTimeout: 3000 })

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
