/**
 * The one API client. Every request in this app goes through it.
 *
 * There is no `fetch()` anywhere else in the codebase — that rule is what keeps
 * session credentials, CSRF and Arabic error handling in a single place.
 */

export interface ApiMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ApiEnvelope<T> {
  data: T
  message?: string
  meta?: ApiMeta
}

export type FieldErrors = Record<string, string[]>

/** Every failure surfaces as this shape, carrying an Arabic message. */
export class ApiError extends Error {
  readonly status: number
  readonly errors?: FieldErrors

  constructor(status: number, message: string, errors?: FieldErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  /** True when the user needs to sign in, not when they lack permission. */
  get isUnauthenticated() {
    return this.status === 401
  }
}

const NETWORK_ERROR = 'تعذّر الاتصال بالخادم، تحقّق من اتصالك بالإنترنت'
const UNKNOWN_ERROR = 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

/**
 * Django sets the CSRF cookie on `GET /api/auth/csrf/`. If an unsafe request is
 * the very first thing the app does, fetch the cookie first rather than sending
 * a request that is guaranteed to 403.
 */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie('csrftoken')
  if (existing) return existing
  await fetch('/api/auth/csrf/', { credentials: 'include' })
  return readCookie('csrftoken')
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Plain object (JSON) or FormData (multipart, for image upload). */
  body?: unknown
  /** Query string parameters; undefined and null values are dropped. */
  params?: Record<string, string | number | boolean | undefined | null>
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`
  if (!params) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

async function parseError(response: Response): Promise<ApiError> {
  let message = UNKNOWN_ERROR
  let errors: FieldErrors | undefined

  try {
    const payload = await response.json()
    if (typeof payload?.message === 'string') message = payload.message
    if (payload?.errors && typeof payload.errors === 'object') errors = payload.errors
  } catch {
    // A non-JSON error body (nginx 502, a gateway timeout) keeps the default.
  }

  return new ApiError(response.status, message, errors)
}

interface Preload {
  url: string
  promise: Promise<unknown>
}

declare global {
  interface Window {
    __nasaimPreload?: Preload
  }
}

/**
 * Adopts the response index.html already started for this URL, if there is one.
 *
 * The priming script in index.html fires the product request before any module
 * has loaded, so the API round trip overlaps the bundle download instead of
 * queueing behind it. It is consumed exactly once: a later refetch (a stale
 * query, a retry) must hit the network and see current stock.
 */
function takePreloaded(url: string): Promise<unknown> | null {
  const preload = window.__nasaimPreload
  if (!preload || preload.url !== url) return null
  delete window.__nasaimPreload
  return preload.promise
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const { body, params, headers, ...rest } = options
  const upperMethod = method.toUpperCase()
  const isFormData = body instanceof FormData

  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (body !== undefined && !isFormData) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (UNSAFE_METHODS.has(upperMethod)) {
    const token = await ensureCsrfToken()
    if (token) requestHeaders.set('X-CSRFToken', token)
  }

  const url = buildUrl(path, params)

  if (upperMethod === 'GET') {
    const preloaded = takePreloaded(url)
    if (preloaded) {
      const payload = await preloaded
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload as ApiEnvelope<T>
      }
      // The priming fetch failed or returned a non-envelope (a 404, an offline
      // start). Fall through to a normal request rather than inventing a result.
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      method: upperMethod,
      headers: requestHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR)
  }

  if (response.status === 204) {
    return { data: undefined as T }
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    // A 2xx with a non-JSON body (a proxy interposing an HTML page) is not a
    // result the caller can use — surface it as an ApiError, not a raw
    // SyntaxError that bypasses every error branch.
    throw new ApiError(response.status, UNKNOWN_ERROR)
  }
  // The server always wraps in {data}. Tolerate a bare payload so a single
  // non-conforming endpoint degrades instead of throwing.
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload as ApiEnvelope<T>
  }
  return { data: payload as T }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}
