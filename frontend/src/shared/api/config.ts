// VITE_API_URL wins (full URL, e.g. http://localhost/api in tests). On Render the
// blueprint passes the API's service host instead, which is the internal name
// (`leaseflow-api-xxxx`) without a domain, so the public onrender.com domain is added.
const host = import.meta.env.VITE_API_HOST
const publicHost = host && !host.includes('.') ? `${host}.onrender.com` : host

export const API_URL =
  import.meta.env.VITE_API_URL ?? (publicHost ? `https://${publicHost}/api` : '/api')
