import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDateTime, formatPercent, leadStatusLabel } from '@/shared/lib/format'
import { i18n, LanguageSwitcher } from '@/shared/i18n'
import { LANGUAGE_STORAGE_KEY } from '@/shared/i18n/languages'
import { resources } from './resources'

/** Every leaf key path of a nested JSON object, e.g. `leadStatus.new`. */
function keyPaths(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object' ? keyPaths(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

describe('translations', () => {
  const namespaces = Object.keys(resources.en) as (keyof typeof resources.en)[]

  it.each(Object.keys(resources).filter((lng) => lng !== 'en'))('%s has every English key', (lng) => {
    for (const ns of namespaces) {
      const other = resources[lng as keyof typeof resources][ns]
      expect(keyPaths(other).sort(), `${lng}/${ns}`).toEqual(keyPaths(resources.en[ns]).sort())
    }
  })
})

describe('LanguageSwitcher', () => {
  it('switches language, persists the choice and updates <html lang>', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher />)

    expect(leadStatusLabel('won')).toBe('Won')
    await user.selectOptions(screen.getByLabelText('Language'), 'pt-BR')

    expect(screen.getByLabelText('Idioma')).toHaveValue('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR')
    expect(leadStatusLabel('won')).toBe('Fechado')
  })
})

describe('locale-aware formatting', () => {
  it('writes USD rent the way each locale expects', async () => {
    expect(formatCurrency(1250)).toBe('$1,250')
    expect(formatPercent(0.92)).toBe('92%')
    await i18n.changeLanguage('pt-BR')
    expect(formatCurrency(1250).replace(/\s/g, ' ')).toBe('US$ 1.250') // Intl uses a no-break space
    expect(formatPercent(0.92)).toBe('92%')
  })

  it('formats dates in the active language', async () => {
    const date = new Date(2026, 10, 10, 9, 30)
    expect(formatDateTime(date)).toMatch(/Nov 10, 2026/)
    await i18n.changeLanguage('pt-BR')
    expect(formatDateTime(date)).toMatch(/10 de nov\.? de 2026/)
  })
})
