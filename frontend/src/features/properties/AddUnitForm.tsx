import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCreateUnitMutation } from './propertiesApi'
import styles from './PropertyDetailPage.module.css'

// The schema is the single source of truth: validation rules + the TS type.
const unitSchema = z.object({
  label: z.string().trim().min(1, 'Required').max(20),
  bedrooms: z.coerce.number<string>().int().min(0).max(10),
  bathrooms: z.coerce.number<string>().min(0).max(10),
  square_feet: z.coerce.number<string>().int().positive('Must be greater than 0'),
  rent: z.coerce.number<string>().positive('Rent must be greater than 0'),
  status: z.enum(['vacant', 'notice', 'occupied']),
})
type UnitFormInput = z.input<typeof unitSchema>
type UnitFormValues = z.output<typeof unitSchema>

export function AddUnitForm({ propertyId }: { propertyId: number }) {
  const [createUnit, { isLoading, error }] = useCreateUnitMutation()
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
    reset()
  })

  const fields = [
    { name: 'label', label: 'Unit', type: 'text' },
    { name: 'bedrooms', label: 'Beds', type: 'number' },
    { name: 'bathrooms', label: 'Baths', type: 'number' },
    { name: 'square_feet', label: 'Sq ft', type: 'number' },
    { name: 'rent', label: 'Rent ($)', type: 'number' },
  ] as const

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit} noValidate aria-label="Add unit">
      <h2 className={styles.formTitle}>Add a unit</h2>
      <div className={styles.formGrid}>
        {fields.map((field) => (
          <div className="field" key={field.name}>
            <label htmlFor={`unit-${field.name}`}>{field.label}</label>
            <input
              id={`unit-${field.name}`}
              className="input"
              type={field.type}
              step={field.name === 'bathrooms' ? '0.5' : undefined}
              aria-invalid={errors[field.name] ? 'true' : 'false'}
              {...register(field.name)}
            />
            {errors[field.name] && (
              <span className="field-error">{errors[field.name]?.message}</span>
            )}
          </div>
        ))}
        <div className="field">
          <label htmlFor="unit-status">Status</label>
          <select id="unit-status" className="select" {...register('status')}>
            <option value="vacant">Vacant</option>
            <option value="notice">On notice</option>
            <option value="occupied">Occupied</option>
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="field-error">
          Could not save the unit. Is the label unique for this property?
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={isLoading}>
        {isLoading ? 'Saving…' : 'Add unit'}
      </button>
    </form>
  )
}
