import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { UNIT_STATUSES } from '@/shared/api/types'
import { unitStatusLabel } from '@/shared/lib/format'
import { useToast } from '@/shared/ui/toastContext'
import { useCreateUnitMutation } from './propertiesApi'
import styles from './PropertyDetailPage.module.css'

// The schema is the single source of truth: validation rules + the TS type.
// Messages are translation keys (form.errors.*), resolved with t() when rendered.
const unitSchema = z.object({
  label: z.string().trim().min(1, 'required').max(20, 'tooLong'),
  bedrooms: z.coerce.number<string>().int('wholeNumber').min(0, 'range').max(10, 'range'),
  bathrooms: z.coerce.number<string>().min(0, 'range').max(10, 'range'),
  square_feet: z.coerce.number<string>().int('wholeNumber').positive('positive'),
  rent: z.coerce.number<string>().positive('rentPositive'),
  status: z.enum(UNIT_STATUSES),
})
type UnitFormInput = z.input<typeof unitSchema>
type UnitFormValues = z.output<typeof unitSchema>
type ErrorKey = 'required' | 'tooLong' | 'wholeNumber' | 'range' | 'positive' | 'rentPositive'

export function AddUnitForm({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation('properties')
  const [createUnit, { isLoading, error }] = useCreateUnitMutation()
  const notify = useToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UnitFormInput, unknown, UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      label: '',
      bedrooms: '1',
      bathrooms: '1',
      square_feet: '650',
      rent: '',
      status: 'vacant',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    await createUnit({ propertyId, unit: values }).unwrap()
    notify(t('form.added', { label: values.label }))
    reset()
  })

  const fields = [
    { name: 'label', label: 'form.unit', type: 'text' },
    { name: 'bedrooms', label: 'form.beds', type: 'number' },
    { name: 'bathrooms', label: 'form.baths', type: 'number' },
    { name: 'square_feet', label: 'form.sqft', type: 'number' },
    { name: 'rent', label: 'form.rent', type: 'number' },
  ] as const

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit} noValidate aria-label={t('form.label')}>
      <h2 className={styles.formTitle}>{t('form.title')}</h2>
      <div className={styles.formGrid}>
        {fields.map((field) => (
          <div className="field" key={field.name}>
            <label htmlFor={`unit-${field.name}`}>{t(field.label)}</label>
            <input
              id={`unit-${field.name}`}
              className="input"
              type={field.type}
              step={field.name === 'bathrooms' ? '0.5' : undefined}
              aria-invalid={errors[field.name] ? 'true' : 'false'}
              {...register(field.name)}
            />
            {errors[field.name] && (
              <span className="field-error">{t(`form.errors.${errors[field.name]?.message as ErrorKey}`)}</span>
            )}
          </div>
        ))}
        <div className="field">
          <label htmlFor="unit-status">{t('form.status')}</label>
          <select id="unit-status" className="select" {...register('status')}>
            {UNIT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {unitStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {t('form.saveError')}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={isLoading}>
        {isLoading ? t('form.saving') : t('form.submit')}
      </button>
    </form>
  )
}
