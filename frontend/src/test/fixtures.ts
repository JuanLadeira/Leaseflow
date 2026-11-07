import type { LeadDetail, LeadListItem, Page, Property, User } from '@/shared/api/types'

export const API = 'http://localhost/api'

export const demoUser: User = {
  id: 1,
  username: 'demo',
  email: 'demo@leaseflow.dev',
  first_name: 'Demo',
  last_name: 'Agent',
}

export const properties: Property[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: i % 2 ? `Harbor View ${i}` : `Maple Court ${i}`,
  address: `${i + 1} Main St`,
  city: i % 2 ? 'Boston' : 'Chicago',
  state: i % 2 ? 'MA' : 'IL',
  image_url: '',
  unit_count: 10,
  vacant_count: 2,
  occupancy_rate: 0.8,
}))

export function pageOf<T>(items: T[], page: number, pageSize: number): Page<T> {
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    count: items.length,
    page,
    page_size: pageSize,
  }
}

export const leads: LeadListItem[] = Array.from({ length: 300 }, (_, i) => ({
  id: i + 1,
  full_name: `Lead ${i + 1}`,
  email: `lead${i + 1}@example.com`,
  status: i % 3 === 0 ? 'new' : 'contacted',
  source: 'zillow',
  unit_label: '1B',
  property_name: 'Maple Court',
  last_message_preview: 'Is the unit still available?',
  last_activity_at: new Date().toISOString(),
}))

export const leadDetail: LeadDetail = {
  id: 1,
  full_name: 'Ava Smith',
  email: 'ava@example.com',
  phone: '+1 555 000 1111',
  status: 'new',
  source: 'zillow',
  desired_move_in: '2026-12-01',
  budget: '2000.00',
  created_at: '2026-11-01T10:00:00Z',
  last_activity_at: '2026-11-01T10:00:00Z',
  unit: { id: 7, label: '1B', property_id: 1, property_name: 'Maple Court', rent: '1900.00' },
  messages: [
    {
      id: 1,
      direction: 'inbound',
      body: 'Hi! Is unit 1B still available?',
      ai_generated: false,
      created_at: '2026-11-01T10:00:00Z',
    },
  ],
}
