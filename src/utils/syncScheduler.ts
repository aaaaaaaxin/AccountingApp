export type SyncResult = { pulled: number; pushed: number; version: number }

export type SyncUiStatus = {
  status: 'idle' | 'syncing' | 'ok' | 'error'
  message?: string
  lastSyncAt?: string
  lastResult?: SyncResult
}

export function createSyncScheduler(args: {
  run: () => Promise<SyncResult>
  onStatus: (s: SyncUiStatus) => void
  onSuccess?: (r: SyncResult) => void | Promise<void>
  maxBackoffMs?: number
}) {
  const maxBackoffMs = args.maxBackoffMs ?? 5 * 60 * 1000

  let inFlight = false
  let pending = false
  let timer: number | null = null
  let backoffMs = 0
  let nextAllowedAt = 0
  let authBlocked = false
  let lastErrorAt = 0

  const clearTimer = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  const scheduleAt = (whenMs: number) => {
    clearTimer()
    const delay = Math.max(0, whenMs - Date.now())
    timer = window.setTimeout(() => void runOnce(), delay)
  }

  const shouldPauseForAuth = (e: unknown): string | null => {
    if (!e || typeof e !== 'object') return null
    const status = (e as any).status
    const detail = (e as any).detail
    if (status === 401) return '未登录'
    if (status === 403 && (detail === 'csrf_required' || detail === 'csrf_invalid')) return '需要重新登录'
    if (status === 400 && (detail === 'delete_not_supported' || detail === 'unknown_entity_type')) return '后端未更新，暂不支持账本删除同步'
    return null
  }

  const recordFailure = (message: string) => {
    backoffMs = backoffMs ? Math.min(maxBackoffMs, backoffMs * 2) : 2_000
    nextAllowedAt = Date.now() + backoffMs
    args.onStatus({ status: 'error', message })
    scheduleAt(nextAllowedAt)
  }

  const runOnce = async () => {
    clearTimer()
    if (inFlight) {
      pending = true
      return
    }
    if (authBlocked) {
      pending = false
      return
    }
    if (Date.now() < nextAllowedAt) {
      scheduleAt(nextAllowedAt)
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      recordFailure('离线')
      return
    }

    inFlight = true
    args.onStatus({ status: 'syncing' })
    try {
      const result = await args.run()
      backoffMs = 0
      nextAllowedAt = 0
      authBlocked = false
      const now = new Date()
      args.onStatus({
        status: 'ok',
        lastSyncAt: now.toISOString().replace('T', ' ').slice(0, 19),
        lastResult: result,
      })
      if (args.onSuccess) {
        await args.onSuccess(result)
      }
    } catch (e) {
      const authMsg = shouldPauseForAuth(e)
      if (authMsg) {
        authBlocked = true
        backoffMs = 0
        nextAllowedAt = 0
        args.onStatus({ status: 'error', message: authMsg })
        return
      }
      const nowMs = Date.now()
      if (nowMs - lastErrorAt > 4_000) {
        lastErrorAt = nowMs
        recordFailure(e instanceof Error ? e.message : '同步失败')
      } else {
        backoffMs = backoffMs ? Math.min(maxBackoffMs, backoffMs * 2) : 2_000
        nextAllowedAt = Date.now() + backoffMs
        scheduleAt(nextAllowedAt)
      }
    } finally {
      inFlight = false
      if (pending) {
        pending = false
        scheduleAt(Date.now())
      }
    }
  }

  const trigger = (opts?: { force?: boolean }) => {
    authBlocked = false
    pending = true
    if (opts?.force) {
      backoffMs = 0
      nextAllowedAt = 0
      scheduleAt(Date.now())
      return
    }
    scheduleAt(Math.max(Date.now(), nextAllowedAt))
  }

  const stop = () => {
    pending = false
    inFlight = false
    clearTimer()
  }

  return { trigger, stop }
}
