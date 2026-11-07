// Mirrors the Django Ninja schemas (see backend/<app>/schemas.py).
// Decimals are serialized as strings by the API to avoid float rounding.

export type UnitStatus = 'vacant' | 'notice' | 'occupied'

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'tour_scheduled',
  'applied',
  'won',
  'lost',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export type LeadSource = 'website' | 'zillow' | 'apartments_com' | 'referral' | 'walk_in'

export interface Page<T> {
  items: T[]
  count: number
  page: number
  page_size: number
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
}

export interface TokenPair {
  access: string
  refresh: string
}

export interface Unit {
  id: number
  property_id: number
  label: string
  bedrooms: number
  bathrooms: string
  square_feet: number
  rent: string
  status: UnitStatus
  available_from: string | null
}

export interface Property {
  id: number
  name: string
  address: string
  city: string
  state: string
  image_url: string
  unit_count: number
  vacant_count: number
  occupancy_rate: number
}

export interface PropertyDetail extends Property {
  units: Unit[]
}

export interface LeadListItem {
  id: number
  full_name: string
  email: string
  status: LeadStatus
  source: LeadSource
  unit_id: number | null
  unit_label: string | null
  property_name: string | null
  last_message_preview: string
  last_activity_at: string
}

export interface Message {
  id: number
  direction: 'inbound' | 'outbound'
  body: string
  ai_generated: boolean
  created_at: string
}

export interface LeadDetail {
  id: number
  full_name: string
  email: string
  phone: string
  status: LeadStatus
  source: LeadSource
  desired_move_in: string | null
  budget: string | null
  created_at: string
  last_activity_at: string
  unit: {
    id: number
    label: string
    property_id: number
    property_name: string
    rent: string
  } | null
  messages: Message[]
}

export const VISIT_STATUSES = ['scheduled', 'completed', 'canceled'] as const
export type VisitStatus = (typeof VISIT_STATUSES)[number]

export interface Visit {
  id: number
  lead_id: number
  lead_name: string
  unit_id: number
  unit_label: string
  property_id: number
  property_name: string
  agent_id: number | null
  agent_name: string | null
  starts_at: string
  ends_at: string
  status: VisitStatus
  notes: string
}

export interface VisitIn {
  lead_id: number
  unit_id?: number | null
  starts_at: string
  ends_at: string
  notes: string
}

export interface VisitConflict extends ApiError {
  conflict: Visit | null
}

export interface Dashboard {
  total_units: number
  vacant_units: number
  occupancy_rate: number
  leads_by_status: Record<LeadStatus, number>
  conversion_rate: number
}

export interface ApiError {
  detail: string
}
