import { useEffect, useRef, useState } from 'react'
import { storage } from '../../utils/storage'
import { resolveBackendUrl } from '../../utils/api'
import { useAppDialog } from '../common/AppDialogProvider'

export function SettingsPage(props: {
  open: boolean
  onClose: () => void
  authUsername: string
  authError: string | null
  onLogout: () => void | Promise<void>
  syncStatus: { status: 'idle' | 'syncing' | 'ok' | 'error'; message?: string; lastSyncAt?: string; lastResult?: { pulled: number; pushed: number; version: number } }
  onSyncNow: () => void | Promise<void>
  currentLedgerId: string | null
  onDataChanged: () => void | Promise<void>
}) {
  const dialog = useAppDialog()
  const [recycleOpen, setRecycleOpen] = useState(false)
  const [deletedItems, setDeletedItems] = useState<import('../../types').Transaction[]>([])
  const [recycleLoading, setRecycleLoading] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [sheetMounted, setSheetMounted] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [sheetDragY, setSheetDragY] = useState(0)
  const [sheetDragging, setSheetDragging] = useState(false)
  const sheetDragStartYRef = useRef<number | null>(null)

  const [recycleMounted, setRecycleMounted] = useState(false)
  const [recycleVisible, setRecycleVisible] = useState(false)
  const [recycleDragY, setRecycleDragY] = useState(0)
  const [recycleDragging, setRecycleDragging] = useState(false)
  const recycleDragStartYRef = useRef<number | null>(null)
  const recycleDragStartTimeRef = useRef<number | null>(null)
  const recycleDragLastRef = useRef<{ y: number; t: number } | null>(null)
  const sheetContainerRef = useRef<HTMLDivElement | null>(null)
  const recycleContainerRef = useRef<HTMLDivElement | null>(null)
  const sheetDragStartTimeRef = useRef<number | null>(null)
  const sheetDragLastRef = useRef<{ y: number; t: number } | null>(null)
  const sheetCloseInFlightRef = useRef(false)
  const recycleCloseInFlightRef = useRef(false)

  const refreshRecycle = async () => {
    if (!props.currentLedgerId) return
    setRecycleLoading(true)
    try {
      const items = await storage.getDeletedTransactions(props.currentLedgerId, 200, 0)
      setDeletedItems(items)
    } finally {
      setRecycleLoading(false)
    }
  }

  const refreshCounts = async () => {
    try {
      const total = await storage.getTotalTransactionCount()
      setTotalCount(total)
    } catch {
      setTotalCount(null)
    }
  }

  useEffect(() => {
    if (!props.open) return
    refreshRecycle()
    refreshCounts()
  }, [props.open, props.currentLedgerId])

  useEffect(() => {
    if (props.open) {
      setSheetMounted(true)
      setSheetDragY(0)
      setSheetDragging(false)
      sheetCloseInFlightRef.current = false
      requestAnimationFrame(() => setSheetVisible(true))
      return
    }
    if (!sheetMounted) return
    setSheetVisible(false)
    setSheetDragY(0)
    setSheetDragging(false)
    const t = window.setTimeout(() => setSheetMounted(false), 200)
    return () => window.clearTimeout(t)
  }, [props.open, sheetMounted])

  useEffect(() => {
    if (recycleOpen) {
      setRecycleMounted(true)
      setRecycleDragY(0)
      setRecycleDragging(false)
      recycleCloseInFlightRef.current = false
      requestAnimationFrame(() => setRecycleVisible(true))
      return
    }
    if (!recycleMounted) return
    setRecycleVisible(false)
    setRecycleDragY(0)
    setRecycleDragging(false)
    const t = window.setTimeout(() => setRecycleMounted(false), 200)
    return () => window.clearTimeout(t)
  }, [recycleOpen, recycleMounted])

  if (!sheetMounted) return null

  const deletedCount = deletedItems.length
  const rubberBandY = (dy: number) => {
    const max = 520
    const cap = 720
    const v = Math.max(0, Math.min(dy, cap))
    if (v <= max) return v * 0.9
    return max * 0.9 + (v - max) * 0.2
  }
  const requestClose = (options?: { feedback?: boolean }) => {
    if (sheetCloseInFlightRef.current) return
    sheetCloseInFlightRef.current = true

    if (options?.feedback && !sheetDragging) {
      setSheetDragY(18)
      window.setTimeout(() => {
        setSheetVisible(false)
        setSheetDragY(0)
        setSheetDragging(false)
        window.setTimeout(() => props.onClose(), 200)
      }, 70)
      return
    }

    setSheetVisible(false)
    setSheetDragY(0)
    setSheetDragging(false)
    window.setTimeout(() => props.onClose(), 200)
  }

  const requestRecycleClose = (options?: { feedback?: boolean }) => {
    if (recycleCloseInFlightRef.current) return
    recycleCloseInFlightRef.current = true

    if (options?.feedback && !recycleDragging) {
      setRecycleDragY(18)
      window.setTimeout(() => {
        setRecycleVisible(false)
        setRecycleDragY(0)
        setRecycleDragging(false)
        window.setTimeout(() => setRecycleOpen(false), 200)
      }, 70)
      return
    }

    setRecycleVisible(false)
    setRecycleDragY(0)
    setRecycleDragging(false)
    window.setTimeout(() => setRecycleOpen(false), 200)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.45)',
        opacity: sheetVisible ? 1 : 0,
        transition: 'opacity 200ms ease',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        zIndex: 1500,
      }}
      onClick={() => requestClose({ feedback: true })}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#f6f7f9',
          borderTopLeftRadius: '18px',
          borderTopRightRadius: '18px',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '12px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          maxHeight: '92vh',
          overflow: sheetDragging ? 'hidden' : 'auto',
          boxShadow: '0 -16px 40px rgba(0,0,0,0.18)',
          transform: `translateY(${sheetVisible ? rubberBandY(sheetDragY) : 520}px)`,
          transition: sheetDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
        ref={sheetContainerRef}
      >
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            if ((sheetContainerRef.current?.scrollTop || 0) > 0) return
            sheetDragStartYRef.current = e.clientY
            sheetDragStartTimeRef.current = performance.now()
            sheetDragLastRef.current = { y: e.clientY, t: performance.now() }
            setSheetDragging(true)
            setSheetDragY(0)
            ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!sheetDragging) return
            if (sheetDragStartYRef.current === null) return
            const dy = Math.max(0, e.clientY - sheetDragStartYRef.current)
            setSheetDragY(Math.min(dy, 720))
            sheetDragLastRef.current = { y: e.clientY, t: performance.now() }
          }}
          onPointerUp={(e) => {
            if (!sheetDragging) return
            ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
            const dy = sheetDragY
            const startY = sheetDragStartYRef.current
            const startT = sheetDragStartTimeRef.current
            const last = sheetDragLastRef.current
            sheetDragStartYRef.current = null
            sheetDragStartTimeRef.current = null
            sheetDragLastRef.current = null
            setSheetDragging(false)
            const velocity =
              startY !== null && startT !== null && last && last.t > startT ? Math.max(0, (last.y - startY) / (last.t - startT)) : 0
            if (dy >= 110 || (dy >= 60 && velocity >= 0.8)) {
              requestClose()
              return
            }
            setSheetDragY(0)
          }}
          onPointerCancel={(e) => {
            if (!sheetDragging) return
            try {
              ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
            } catch {
            }
            sheetDragStartYRef.current = null
            sheetDragStartTimeRef.current = null
            sheetDragLastRef.current = null
            setSheetDragging(false)
            setSheetDragY(0)
          }}
        >
          <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'rgba(0,0,0,0.18)' }} />
        </div>

        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '44px', height: '44px' }} />
            <div style={{ fontWeight: 900, fontSize: '16px', color: '#111' }}>设置</div>
            <button
              type="button"
              onClick={() => requestClose()}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <section style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', fontWeight: 700, marginBottom: '10px' }}>账号</div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#2c3e50' }}>当前登录</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#111' }}>{props.authUsername}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={resolveBackendUrl('/admin/invites/page')}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(22,119,255,0.25)',
                    background: 'rgba(22,119,255,0.08)',
                    textDecoration: 'none',
                    color: '#1677ff',
                    fontSize: '13px',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  邀请码管理
                </a>
                <button
                  type="button"
                  onClick={() => props.onLogout()}
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#111',
                  }}
                >
                  退出登录
                </button>
              </div>
              {props.authError && <div style={{ fontSize: '12px', color: '#d63031' }}>{props.authError}</div>}
            </div>
          </section>

          <section style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', color: '#666', fontWeight: 700 }}>同步</div>
              <button
                type="button"
                onClick={() => props.onSyncNow()}
                disabled={props.syncStatus.status === 'syncing'}
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#1677ff',
                  color: '#fff',
                  cursor: props.syncStatus.status === 'syncing' ? 'not-allowed' : 'pointer',
                  opacity: props.syncStatus.status === 'syncing' ? 0.75 : 1,
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                立即同步
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 800,
                    background:
                      props.syncStatus.status === 'ok'
                        ? 'rgba(46,125,99,0.12)'
                        : props.syncStatus.status === 'syncing'
                          ? 'rgba(22,119,255,0.12)'
                          : props.syncStatus.status === 'error'
                            ? 'rgba(214,48,49,0.12)'
                            : 'rgba(0,0,0,0.06)',
                    color:
                      props.syncStatus.status === 'ok'
                        ? '#2e7d63'
                        : props.syncStatus.status === 'syncing'
                          ? '#1677ff'
                          : props.syncStatus.status === 'error'
                            ? '#d63031'
                            : '#666',
                  }}
                >
                  {props.syncStatus.status === 'idle'
                    ? '未同步'
                    : props.syncStatus.status === 'syncing'
                      ? '同步中'
                      : props.syncStatus.status === 'ok'
                        ? '已同步'
                        : '失败'}
                </span>
                {props.syncStatus.lastSyncAt && <span style={{ fontSize: '12px', color: '#666' }}>{props.syncStatus.lastSyncAt}</span>}
              </div>
            </div>
            {props.syncStatus.message && <div style={{ marginTop: '8px', fontSize: '12px', color: '#d63031' }}>{props.syncStatus.message}</div>}
            {props.syncStatus.lastResult && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
                {props.syncStatus.lastResult.pulled === 0 && props.syncStatus.lastResult.pushed === 0 ? (
                  <>本次无变更（已是最新） / 当前版本 {props.syncStatus.lastResult.version}</>
                ) : (
                  <>
                    本次拉取 {props.syncStatus.lastResult.pulled} 条 / 上报 {props.syncStatus.lastResult.pushed} 条 / 当前版本 {props.syncStatus.lastResult.version}
                  </>
                )}
              </div>
            )}
          </section>

          <section style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', color: '#666', fontWeight: 700 }}>回收站</div>
              <div style={{ fontSize: '12px', color: '#666' }}>已删除记录：{deletedCount}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setRecycleOpen(true)}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#111',
                }}
              >
                打开回收站
              </button>
              <button
                type="button"
                onClick={() => refreshRecycle()}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#111',
                }}
              >
                刷新
              </button>
            </div>
          </section>

          <section style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', fontWeight: 700, marginBottom: '10px' }}>数据</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: '#2c3e50' }}>总记录数</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#111' }}>{totalCount === null ? '-' : totalCount}</div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
              删除的记录会保留在回收站中，服务端会按 30 天自动清理（并通过同步传播）。
            </div>
          </section>
        </div>

        {recycleOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.45)',
              opacity: recycleVisible ? 1 : 0,
              transition: 'opacity 200ms ease',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '0',
              zIndex: 1600,
            }}
            onClick={() => requestRecycleClose({ feedback: true })}
          >
            {recycleMounted && (
              <div
              style={{
                width: '100%',
                maxWidth: '720px',
                background: '#f6f7f9',
                borderTopLeftRadius: '18px',
                borderTopRightRadius: '18px',
                border: '1px solid rgba(0,0,0,0.06)',
                padding: '12px',
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
                maxHeight: '92vh',
                overflow: recycleDragging ? 'hidden' : 'auto',
                boxShadow: '0 -16px 40px rgba(0,0,0,0.18)',
                transform: `translateY(${recycleVisible ? rubberBandY(recycleDragY) : 520}px)`,
                transition: recycleDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
              onClick={(e) => e.stopPropagation()}
              ref={recycleContainerRef}
            >
              <div
                style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  if ((recycleContainerRef.current?.scrollTop || 0) > 0) return
                  recycleDragStartYRef.current = e.clientY
                  recycleDragStartTimeRef.current = performance.now()
                  recycleDragLastRef.current = { y: e.clientY, t: performance.now() }
                  setRecycleDragging(true)
                  setRecycleDragY(0)
                  ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  if (!recycleDragging) return
                  if (recycleDragStartYRef.current === null) return
                  const dy = Math.max(0, e.clientY - recycleDragStartYRef.current)
                  setRecycleDragY(Math.min(dy, 720))
                  recycleDragLastRef.current = { y: e.clientY, t: performance.now() }
                }}
                onPointerUp={(e) => {
                  if (!recycleDragging) return
                  ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
                  const dy = recycleDragY
                  const startY = recycleDragStartYRef.current
                  const startT = recycleDragStartTimeRef.current
                  const last = recycleDragLastRef.current
                  recycleDragStartYRef.current = null
                  recycleDragStartTimeRef.current = null
                  recycleDragLastRef.current = null
                  setRecycleDragging(false)
                  const velocity =
                    startY !== null && startT !== null && last && last.t > startT ? Math.max(0, (last.y - startY) / (last.t - startT)) : 0
                  if (dy >= 110 || (dy >= 60 && velocity >= 0.8)) {
                    requestRecycleClose()
                    return
                  }
                  setRecycleDragY(0)
                }}
                onPointerCancel={(e) => {
                  if (!recycleDragging) return
                  try {
                    ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
                  } catch {
                  }
                  recycleDragStartYRef.current = null
                  recycleDragStartTimeRef.current = null
                  recycleDragLastRef.current = null
                  setRecycleDragging(false)
                  setRecycleDragY(0)
                }}
              >
                <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'rgba(0,0,0,0.18)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontWeight: 900, color: '#111' }}>回收站</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await dialog.confirm({
                        title: '彻底删除回收站',
                        message: '将永久删除回收站内的所有数据，删除后不可恢复。确定继续吗？',
                        okText: '确定删除',
                        cancelText: '取消',
                      })
                      if (!ok) return
                      await storage.setPendingPurgeToken(new Date().toISOString())
                      await storage.purgeDeletedTransactionsLocal()
                      await refreshRecycle()
                      await refreshCounts()
                      await props.onDataChanged()
                      await props.onSyncNow()
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(214,48,49,0.25)',
                      background: 'rgba(214,48,49,0.08)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      color: '#d63031',
                      fontSize: '13px',
                    }}
                  >
                    彻底删除
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      requestRecycleClose()
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '999px',
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '16px',
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="关闭"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                {recycleLoading ? (
                  <div style={{ padding: '12px', color: '#666', fontSize: '13px' }}>加载中...</div>
                ) : deletedItems.length === 0 ? (
                  <div style={{ padding: '12px', color: '#666', fontSize: '13px' }}>回收站为空</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {deletedItems.map((t) => (
                      <div key={t.id} style={{ padding: '12px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#2c3e50' }}>
                            {t.type === 'expense' ? '-' : '+'}¥{t.amount.toFixed(2)} <span style={{ color: '#666', fontWeight: 400 }}>{t.date}</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await storage.restoreTransactionLocal(t.id)
                              await refreshRecycle()
                              await props.onDataChanged()
                              await props.onSyncNow()
                            }}
                            style={{ padding: '8px 12px', borderRadius: '12px', border: 'none', background: '#2e7d63', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
                          >
                            恢复
                          </button>
                        </div>
                        {t.note && <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>{t.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
