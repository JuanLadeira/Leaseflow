import { combineSlices, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from '@/shared/api/baseApi'

// Server state lives in RTK Query's cache. UI state that should survive a
// reload or be shareable (filters, page) lives in the URL. A slice gets added
// here only when real shared client state appears.
const rootReducer = combineSlices(baseApi)
export type RootState = ReturnType<typeof rootReducer>

/** Factory so every test gets an isolated store (and cache). */
export function makeStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  })
  setupListeners(store.dispatch) // refetchOnFocus / refetchOnReconnect support
  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
