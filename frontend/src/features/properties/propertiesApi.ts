import { baseApi } from '@/shared/api/baseApi'
import type { Page, Property, PropertyDetail, Unit, UnitStatus } from '@/shared/api/types'

export interface PropertiesArgs {
  search?: string
  page?: number
  pageSize?: number
}

export interface NewUnit {
  label: string
  bedrooms: number
  bathrooms: number
  square_feet: number
  rent: number
  status: UnitStatus
  available_from?: string | null
}

export const propertiesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProperties: build.query<Page<Property>, PropertiesArgs>({
      query: ({ search, page = 1, pageSize = 9 }) => ({
        url: '/properties',
        params: { search: search || undefined, page, page_size: pageSize },
      }),
      providesTags: (result) => [
        { type: 'Property', id: 'LIST' },
        ...(result?.items.map((p) => ({ type: 'Property' as const, id: p.id })) ?? []),
      ],
    }),
    getProperty: build.query<PropertyDetail, number>({
      query: (id) => `/properties/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Property', id }],
    }),
    createUnit: build.mutation<Unit, { propertyId: number; unit: NewUnit }>({
      query: ({ propertyId, unit }) => ({
        url: `/properties/${propertyId}/units`,
        method: 'POST',
        body: unit,
      }),
      // Unit counts change on both the detail and the list cards, and occupancy on the dashboard.
      invalidatesTags: (_result, _error, { propertyId }) => [
        { type: 'Property', id: propertyId },
        { type: 'Property', id: 'LIST' },
        'Dashboard',
      ],
    }),
  }),
})

export const { useGetPropertiesQuery, useGetPropertyQuery, useCreateUnitMutation } = propertiesApi
