type ApiError = Error & { status?: number; detail?: unknown }

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

function resolveApiUrl(path: string): string {
  const base = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined
  if (!base) return path
  if (/^https?:\/\//i.test(path)) return path
  return new URL(path, base).toString()
}

export async function apiRequest<T>(path: string, init?: { method?: string; body?: any; headers?: Record<string, string> }): Promise<T> {
  const method = init?.method || 'GET'
  const headers: Record<string, string> = { ...(init?.headers || {}) }
  const isBody = init?.body !== undefined
  if (isBody) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = getCookie('csrf_token')
    if (csrf) {
      headers['x-csrf-token'] = csrf
    }
  }

  const res = await fetch(resolveApiUrl(path), {
    method,
    credentials: 'include',
    headers,
    body: isBody ? JSON.stringify(init!.body) : undefined,
  })

  const contentType = res.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => null)

  if (!res.ok) {
    const err: ApiError = new Error(typeof payload === 'object' && payload && 'detail' in payload ? String((payload as any).detail) : `HTTP ${res.status}`)
    err.status = res.status
    err.detail = typeof payload === 'object' && payload && 'detail' in payload ? (payload as any).detail : payload
    throw err
  }

  return payload as T
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path)
}

export async function apiPost<T>(path: string, body?: any, headers?: Record<string, string>): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: body ?? {}, headers })
}
