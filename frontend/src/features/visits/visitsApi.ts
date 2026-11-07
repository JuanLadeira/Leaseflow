import { baseApi } from '@/shared/api/baseApi'
import type { Visit, VisitIn, VisitStatus } from '@/shared/api/types'

export interface VisitRange {
  start: string
  end: string
}

const time = (iso: string) => new Date(iso).getTime()
const inRange = (visit: Visit, { start, end }: VisitRange) =>
  time(visit.starts_at) < time(end) && time(visit.ends_at) > time(start)

export const visitsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVisits: build.query<Visit[], VisitRange>({
      query: (range) => ({ url: '/visits', params: range }),
      providesTags: [{ type: 'Visit', id: 'LIST' }],
    }),
    scheduleVisit: build.mutation<Visit, VisitIn>({
      query: (body) => ({ url: '/visits', method: 'POST', body }),
      // Write the new visit into every cached range it belongs to *before* the
      // form action finishes, so the optimistic card is replaced by the real
      // one without a flash while a refetch runs.
      async onQueryStarted(_body, { dispatch, queryFulfilled, getState }) {
        const { data: visit } = await queryFulfilled.catch(() => ({ data: null }))
        if (!visit) return
        for (const { originalArgs } of visitsApi.util.selectInvalidatedBy(getState(), [
          { type: 'Visit', id: 'LIST' },
        ])) {
          const range = originalArgs as VisitRange
          if (!inRange(visit, range)) continue
          dispatch(
            visitsApi.util.updateQueryData('getVisits', range, (draft) => {
              draft.push(visit)
              draft.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
            }),
          )
        }
      },
      // Booking a tour can move the lead to "tour scheduled".
      invalidatesTags: (_result, error, { lead_id }) =>
        error ? [] : [{ type: 'Lead', id: lead_id }, { type: 'Lead', id: 'LIST' }, 'Dashboard'],
    }),
    updateVisitStatus: build.mutation<Visit, { id: number; status: VisitStatus }>({
      query: ({ id, status }) => ({ url: `/visits/${id}`, method: 'PATCH', body: { status } }),
      async onQueryStarted({ id, status }, { dispatch, queryFulfilled, getState }) {
        try {
          await queryFulfilled
        } catch {
          return
        }
        for (const { originalArgs } of visitsApi.util.selectInvalidatedBy(getState(), [
          { type: 'Visit', id: 'LIST' },
        ])) {
          dispatch(
            visitsApi.util.updateQueryData('getVisits', originalArgs as VisitRange, (draft) =>
              status === 'canceled'
                ? draft.filter((visit) => visit.id !== id)
                : draft.map((visit) => (visit.id === id ? { ...visit, status } : visit)),
            ),
          )
        }
      },
    }),
  }),
})

export const { useGetVisitsQuery, useScheduleVisitMutation, useUpdateVisitStatusMutation } =
  visitsApi
