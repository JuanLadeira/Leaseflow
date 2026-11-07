import { baseApi } from '@/shared/api/baseApi'
import type { LeadDetail, LeadListItem, LeadStatus, Message } from '@/shared/api/types'

export interface LeadsArgs {
  status?: LeadStatus | 'all'
  search?: string
}

export const leadsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLeads: build.query<LeadListItem[], LeadsArgs>({
      query: ({ status, search }) => ({
        url: '/leads',
        params: {
          status: status && status !== 'all' ? status : undefined,
          search: search || undefined,
        },
      }),
      providesTags: [{ type: 'Lead', id: 'LIST' }],
    }),
    getLead: build.query<LeadDetail, number>({
      query: (id) => `/leads/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Lead', id }],
    }),
    updateLeadStatus: build.mutation<LeadDetail, { id: number; status: LeadStatus }>({
      query: ({ id, status }) => ({ url: `/leads/${id}`, method: 'PATCH', body: { status } }),
      // Optimistic cache update: patch every cached inbox list right away and
      // roll back if the server rejects the change.
      async onQueryStarted({ id, status }, { dispatch, queryFulfilled, getState }) {
        const patches = leadsApi.util
          .selectInvalidatedBy(getState(), [{ type: 'Lead', id: 'LIST' }])
          .map(({ originalArgs }) =>
            dispatch(
              leadsApi.util.updateQueryData('getLeads', originalArgs as LeadsArgs, (draft) => {
                const row = draft.find((lead) => lead.id === id)
                if (row) row.status = status
              }),
            ),
          )
        try {
          const { data } = await queryFulfilled
          dispatch(leadsApi.util.upsertQueryData('getLead', id, data))
        } catch {
          patches.forEach((patch) => patch.undo())
        }
      },
      invalidatesTags: ['Dashboard'],
    }),
    sendMessage: build.mutation<Message, { leadId: number; body: string; aiGenerated: boolean }>({
      query: ({ leadId, body, aiGenerated }) => ({
        url: `/leads/${leadId}/messages`,
        method: 'POST',
        body: { body, ai_generated: aiGenerated },
      }),
      invalidatesTags: (_result, _error, { leadId }) => [
        { type: 'Lead', id: leadId },
        { type: 'Lead', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetLeadsQuery,
  useGetLeadQuery,
  useUpdateLeadStatusMutation,
  useSendMessageMutation,
} = leadsApi
