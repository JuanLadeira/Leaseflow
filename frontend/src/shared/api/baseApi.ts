import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { tokenStorage } from '@/shared/auth/tokenStorage'
import { API_URL } from './config'
import type { TokenPair } from './types'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders(headers) {
    const token = tokenStorage.getAccess()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

const NO_REFRESH = new Set(['/auth/login', '/auth/refresh'])

// One in-flight refresh shared by every request that got a 401 at the same time.
let refreshing: Promise<boolean> | null = null

async function refreshTokens(api: Parameters<BaseQueryFn>[1], extra: object): Promise<boolean> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return false
  const result = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST', body: { refresh } },
    api,
    extra,
  )
  if (result.data) {
    tokenStorage.set(result.data as TokenPair)
    return true
  }
  return false
}

/** Retries once after refreshing the access token; logs out when refresh fails. */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  let result = await rawBaseQuery(args, api, extra ?? {})
  const url = typeof args === 'string' ? args : args.url
  if (result.error?.status === 401 && !NO_REFRESH.has(url)) {
    refreshing ??= refreshTokens(api, extra ?? {}).finally(() => {
      refreshing = null
    })
    if (await refreshing) {
      result = await rawBaseQuery(args, api, extra ?? {})
    } else {
      tokenStorage.clear()
    }
  }
  return result
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Property', 'Lead', 'Dashboard', 'Visit'],
  endpoints: () => ({}),
})
