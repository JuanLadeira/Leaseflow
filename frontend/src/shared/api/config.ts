// VITE_API_URL wins (full URL, e.g. http://localhost/api in tests). On Render the
// blueprint only knows the API's host name, so VITE_API_HOST builds the URL.
const host = import.meta.env.VITE_API_HOST

export const API_URL = import.meta.env.VITE_API_URL ?? (host ? `https://${host}/api` : '/api')
