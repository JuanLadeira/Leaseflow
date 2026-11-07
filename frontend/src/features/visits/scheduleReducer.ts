import { DURATIONS, slotTimes, type Duration } from './dates'

export interface PickedLead {
  id: number
  name: string
  unitId: number | null
  unitLabel: string | null
  propertyName: string | null
}

export interface ScheduleState {
  leadQuery: string
  lead: PickedLead | null
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  duration: Duration
}

export type ScheduleAction =
  | { type: 'leadQueryChanged'; query: string }
  | { type: 'leadPicked'; lead: PickedLead }
  | { type: 'leadCleared' }
  | { type: 'dateChanged'; date: string }
  | { type: 'durationChanged'; duration: Duration }
  | { type: 'timePicked'; time: string }
  | { type: 'slotTaken' }

export const initialSchedule = (date: string, lead: PickedLead | null = null): ScheduleState => ({
  leadQuery: '',
  lead,
  date,
  time: null,
  duration: 30,
})

/**
 * Structured form state (notes stay an uncontrolled field read from FormData).
 * Every field change that can invalidate another field resets it here, in one
 * place, instead of in scattered effects:
 * - a new lead or a new day means the picked slot may no longer be free;
 * - a longer duration may no longer fit before closing time.
 */
export function scheduleReducer(state: ScheduleState, action: ScheduleAction): ScheduleState {
  switch (action.type) {
    case 'leadQueryChanged':
      return { ...state, leadQuery: action.query }
    case 'leadPicked':
      return { ...state, lead: action.lead, leadQuery: '', time: null }
    case 'leadCleared':
      return { ...state, lead: null, time: null }
    case 'dateChanged':
      return action.date === state.date ? state : { ...state, date: action.date, time: null }
    case 'durationChanged': {
      if (!DURATIONS.includes(action.duration)) return state
      const fits = state.time !== null && slotTimes(action.duration).includes(state.time)
      return { ...state, duration: action.duration, time: fits ? state.time : null }
    }
    case 'timePicked':
      return { ...state, time: action.time }
    case 'slotTaken':
      return { ...state, time: null }
  }
}
