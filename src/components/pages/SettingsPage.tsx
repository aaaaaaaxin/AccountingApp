import { useEffect, useState } from 'react'
import { storage } from '../../utils/storage'

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
  const [recycleOpen, setRecycleOpen] = useState(false)
  const [deletedItems, setDeletedItems] = useState<import('../../types').Transaction[]>([])
  const [recycleLoading, setRecycleLoading] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)

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

  if (!props.open) return null

  const deletedCount = deletedItems.length

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        zIndex: 1500,
      }}
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{ width: '100%', maxWidth: '720px', background: '#fff', borderRadius: '16px', border: '1px solid #eee', padding: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: '16px' }}>设置</div>
          <button
            type="button"
            onClick={props.onClose}
            style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', background: '#1677ff', color: '#fff', cursor: 'pointer' }}
          >
            关闭
          </button>
        </div>

        <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
          <section className="form-section" style={{ margin: 0 }}>
            <h2>账号</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '14px', color: '#2c3e50' }}>
                当前登录：<span style={{ fontWeight: 700 }}>{props.authUsername}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href="/admin/invites/page"
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', textDecoration: 'none', color: '#1677ff' }}
                >
                  邀请码管理
                </a>
                <button
                  type="button"
                  onClick={() => props.onLogout()}
                  className="btn btn--ghost"
                  style={{ padding: '8px 12px', borderRadius: '10px' }}
                >
                  退出登录
                </button>
              </div>
            </div>
            {props.authError && <div style={{ marginTop: '8px', fontSize: '12px', color: '#d63031' }}>{props.authError}</div>}
          </section>

          <section className="form-section" style={{ margin: 0 }}>
            <h2>同步</h2>
            <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid #eee', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px', color: '#2c3e50' }}>
                  状态：{' '}
                  <span style={{ fontWeight: 700 }}>
                    {props.syncStatus.status === 'idle'
                      ? '未同步'
                      : props.syncStatus.status === 'syncing'
                        ? '同步中'
                        : props.syncStatus.status === 'ok'
                          ? '已同步'
                          : '失败'}
                  </span>
                  {props.syncStatus.lastSyncAt && <span style={{ marginLeft: '8px', color: '#666' }}>{props.syncStatus.lastSyncAt}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => props.onSyncNow()}
                  disabled={props.syncStatus.status === 'syncing'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#1677ff',
                    color: '#fff',
                    cursor: props.syncStatus.status === 'syncing' ? 'not-allowed' : 'pointer',
                    opacity: props.syncStatus.status === 'syncing' ? 0.7 : 1,
                  }}
                >
                  立即同步
                </button>
              </div>
              {props.syncStatus.message && <div style={{ marginTop: '8px', fontSize: '12px', color: '#d63031' }}>{props.syncStatus.message}</div>}
              {props.syncStatus.lastResult && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  拉取 {props.syncStatus.lastResult.pulled} 条 / 上报 {props.syncStatus.lastResult.pushed} 条 / 当前版本 {props.syncStatus.lastResult.version}
                </div>
              )}
            </div>
          </section>

          <section className="form-section" style={{ margin: 0 }}>
            <h2>回收站</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: '#666' }}>已删除记录：{deletedCount}</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setRecycleOpen(true)}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                >
                  打开回收站
                </button>
                <button
                  type="button"
                  onClick={() => refreshRecycle()}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                >
                  刷新
                </button>
              </div>
            </div>
          </section>

          <section className="form-section" style={{ margin: 0 }}>
            <h2>数据</h2>
            <div style={{ fontSize: '13px', color: '#666' }}>总记录数：{totalCount === null ? '-' : totalCount}</div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', lineHeight: 1.5 }}>
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
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '18px',
              zIndex: 1600,
            }}
            onClick={() => setRecycleOpen(false)}
          >
            <div
              style={{ width: '100%', maxWidth: '640px', background: '#fff', borderRadius: '16px', border: '1px solid #eee', padding: '16px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700 }}>回收站（交易记录）</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('将永久删除回收站内的所有数据，删除后不可恢复。确定继续吗？')) return
                      await storage.setPendingPurgeToken(new Date().toISOString())
                      await storage.purgeDeletedTransactionsLocal()
                      await refreshRecycle()
                      await refreshCounts()
                      await props.onDataChanged()
                      await props.onSyncNow()
                    }}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                  >
                    彻底删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecycleOpen(false)}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', background: '#1677ff', color: '#fff', cursor: 'pointer' }}
                  >
                    关闭
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
                      <div key={t.id} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #eee', background: '#fafafa' }}>
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
                            style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', background: '#2e7d63', color: '#fff', cursor: 'pointer' }}
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
          </div>
        )}
      </div>
    </div>
  )
}

