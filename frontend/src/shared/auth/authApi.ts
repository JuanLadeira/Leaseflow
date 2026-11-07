import { baseApi } from '@/shared/api/baseApi'
import type { TokenPair, User } from '@/shared/api/types'

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<TokenPair, { username: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    me: build.query<User, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
  }),
})

export const { useLoginMutation, useMeQuery } = authApi
