import { initialSchedule, scheduleReducer, type PickedLead } from './scheduleReducer'

const lead: PickedLead = { id: 1, name: 'Ava', unitId: 7, unitLabel: '1B', propertyName: 'Maple' }

describe('scheduleReducer', () => {
  const base = { ...initialSchedule('2030-01-07', lead), time: '10:00' }

  it('clears the slot when the day or the lead changes', () => {
    expect(scheduleReducer(base, { type: 'dateChanged', date: '2030-01-08' }).time).toBeNull()
    expect(scheduleReducer(base, { type: 'dateChanged', date: '2030-01-07' })).toBe(base)
    expect(scheduleReducer(base, { type: 'leadPicked', lead: { ...lead, id: 2 } }).time).toBeNull()
  })

  it('keeps the slot on a longer duration only if it still fits before closing', () => {
    expect(scheduleReducer(base, { type: 'durationChanged', duration: 60 }).time).toBe('10:00')
    const late = { ...base, time: '17:30' }
    expect(scheduleReducer(late, { type: 'durationChanged', duration: 60 }).time).toBeNull()
  })

  it('picking a lead clears the search box', () => {
    const typing = scheduleReducer(initialSchedule('2030-01-07'), {
      type: 'leadQueryChanged',
      query: 'ava',
    })
    const picked = scheduleReducer(typing, { type: 'leadPicked', lead })
    expect(picked).toMatchObject({ leadQuery: '', lead })
  })
})
