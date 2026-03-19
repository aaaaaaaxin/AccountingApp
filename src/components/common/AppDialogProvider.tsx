import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type DialogRequest =
  | {
      kind: 'alert'
      title?: string
      message: string
      okText?: string
      resolve: () => void
    }
  | {
      kind: 'confirm'
      title?: string
      message: string
      okText?: string
      cancelText?: string
      resolve: (value: boolean) => void
    }

type AppDialogApi = {
  alert: (opts: { title?: string; message: string; okText?: string } | string) => Promise<void>
  confirm: (opts: { title?: string; message: string; okText?: string; cancelText?: string } | string) => Promise<boolean>
  toast: (opts: { message: string; kind?: 'info' | 'success' | 'error'; durationMs?: number } | string) => void
}

const Ctx = createContext<AppDialogApi | null>(null)

export function useAppDialog() {
  const api = useContext(Ctx)
  if (!api) throw new Error('useAppDialog must be used within AppDialogProvider')
  return api
}

export function AppDialogProvider(props: { children: ReactNode }) {
  const [current, setCurrent] = useState<DialogRequest | null>(null)
  const queueRef = useRef<DialogRequest[]>([])
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; kind: 'info' | 'success' | 'error' }>>([])

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() || null
    setCurrent(next)
  }, [])

  const push = useCallback(
    (req: DialogRequest) => {
      if (!current) {
        setCurrent(req)
        return
      }
      queueRef.current.push(req)
    },
    [current],
  )

  const alert = useCallback(
    (opts: { title?: string; message: string; okText?: string } | string) => {
      const normalized = typeof opts === 'string' ? { message: opts } : opts
      return new Promise<void>((resolve) => {
        push({ kind: 'alert', title: normalized.title, message: normalized.message, okText: normalized.okText, resolve })
      })
    },
    [push],
  )

  const confirm = useCallback(
    (opts: { title?: string; message: string; okText?: string; cancelText?: string } | string) => {
      const normalized = typeof opts === 'string' ? { message: opts } : opts
      return new Promise<boolean>((resolve) => {
        push({
          kind: 'confirm',
          title: normalized.title,
          message: normalized.message,
          okText: normalized.okText,
          cancelText: normalized.cancelText,
          resolve,
        })
      })
    },
    [push],
  )

  const toast = useCallback((opts: { message: string; kind?: 'info' | 'success' | 'error'; durationMs?: number } | string) => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const kind = normalized.kind || 'info'
    const durationMs = normalized.durationMs ?? (kind === 'error' ? 2800 : 2000)
    setToasts((prev) => [...prev, { id, message: normalized.message, kind }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, durationMs)
  }, [])

  const api = useMemo<AppDialogApi>(() => ({ alert, confirm, toast }), [alert, confirm, toast])

  const close = useCallback(() => {
    setCurrent(null)
    queueMicrotask(showNext)
  }, [showNext])

  const onBackdrop = useCallback(() => {
    if (!current) return
    if (current.kind === 'confirm') {
      current.resolve(false)
      close()
      return
    }
    current.resolve()
    close()
  }, [close, current])

  const onOk = useCallback(() => {
    if (!current) return
    if (current.kind === 'confirm') {
      current.resolve(true)
      close()
      return
    }
    current.resolve()
    close()
  }, [close, current])

  const onCancel = useCallback(() => {
    if (!current) return
    if (current.kind === 'confirm') {
      current.resolve(false)
      close()
      return
    }
    current.resolve()
    close()
  }, [close, current])

  return (
    <Ctx.Provider value={api}>
      {props.children}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite" aria-relevant="additions">
          {toasts.map((t) => (
            <button key={t.id} type="button" className={`toast toast--${t.kind}`} onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
              {t.message}
            </button>
          ))}
        </div>
      )}
      {current && (
        <div className="dialog-backdrop" onClick={onBackdrop} role="dialog" aria-modal="true">
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            {current.title && <div className="dialog__title">{current.title}</div>}
            <div className="dialog__message">{current.message}</div>
            <div className="dialog__actions">
              {current.kind === 'confirm' && (
                <button type="button" className="dialog__btn" onClick={onCancel}>
                  {current.cancelText || '取消'}
                </button>
              )}
              <button
                type="button"
                className={`dialog__btn ${current.kind === 'confirm' ? 'dialog__btn--primary' : ''}`}
                onClick={onOk}
              >
                {current.okText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
