import { useMemo, useState } from 'react'
import type { Category, Transaction } from '../../types'

type Period = 'week' | 'month' | 'year'
type Mode = 'expense' | 'income'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function rangeLabel(start: string, end: string) {
  const s = start.split('-')
  const e = end.split('-')
  if (s.length === 3 && e.length === 3) return `${s[1]}-${s[2]} ~ ${e[1]}-${e[2]}`
  return `${start} ~ ${end}`
}

function getRange(header: { year: number; month: number }, period: Period) {
  if (period === 'month') {
    const start = `${header.year}-${pad2(header.month)}-01`
    const last = new Date(header.year, header.month, 0).getDate()
    const end = `${header.year}-${pad2(header.month)}-${pad2(last)}`
    return { start, end, label: `${header.year}年${header.month}月` }
  }
  if (period === 'year') {
    const start = `${header.year}-01-01`
    const end = `${header.year}-12-31`
    return { start, end, label: `${header.year}年` }
  }
  const base = new Date(header.year, header.month - 1, 1)
  const day = (base.getDay() + 6) % 7
  const startDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6)
  const start = toDateStr(startDate)
  const end = toDateStr(endDate)
  return { start, end, label: rangeLabel(start, end) }
}

export function ReportSheet(props: {
  open: boolean
  header: { year: number; month: number }
  transactions: Transaction[]
  categories: Category[]
  onClose: () => void
}) {
  const [period, setPeriod] = useState<Period>('month')
  const [mode, setMode] = useState<Mode>('expense')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const range = useMemo(() => getRange(props.header, period), [period, props.header])

  const filteredTxs = useMemo(() => {
    return props.transactions.filter((tx) => {
      if (tx.type !== mode) return false
      if (tx.date < range.start || tx.date > range.end) return false
      if (selectedCategoryId) return tx.categoryId === selectedCategoryId
      return true
    })
  }, [mode, props.transactions, range.end, range.start, selectedCategoryId])

  const categoriesMap = useMemo(() => new Map(props.categories.map((c) => [c.id, c])), [props.categories])

  const segments = useMemo(() => {
    const sums = new Map<string, number>()
    for (const tx of props.transactions) {
      if (tx.type !== mode) continue
      if (tx.date < range.start || tx.date > range.end) continue
      sums.set(tx.categoryId, (sums.get(tx.categoryId) || 0) + tx.amount)
    }
    const items = Array.from(sums.entries()).map(([id, value]) => {
      const c = categoriesMap.get(id)
      return { id, label: c?.name || '未分类', value, color: c?.color || '#dfe8e5' }
    })
    items.sort((a, b) => b.value - a.value)
    const total = items.reduce((s, x) => s + x.value, 0)
    return items.map((x) => ({ ...x, percent: total > 0 ? x.value / total : 0 }))
  }, [categoriesMap, mode, props.transactions, range.end, range.start])

  const selectedCategoryName = selectedCategoryId ? categoriesMap.get(selectedCategoryId)?.name || '未分类' : null

  if (!props.open) return null

  return (
    <div className="sheet-backdrop" onClick={props.onClose} role="dialog" aria-modal="true">
      <div className="sheet sheet--detail" onClick={(e) => e.stopPropagation()}>
        <div className="detail-sheet__header">
          <button type="button" className="detail-sheet__iconbtn" onClick={props.onClose} aria-label="关闭">
            ×
          </button>
          <div className="detail-sheet__title">报表</div>
          <span style={{ width: '36px', height: '36px' }} />
        </div>

        <div className="detail-sheet__content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 800 }}>{range.label}</div>
            <div className="chip-row">
              <button type="button" className={`chip ${period === 'week' ? 'chip--active' : ''}`} onClick={() => setPeriod('week')}>
                周
              </button>
              <button type="button" className={`chip ${period === 'month' ? 'chip--active' : ''}`} onClick={() => setPeriod('month')}>
                月
              </button>
              <button type="button" className={`chip ${period === 'year' ? 'chip--active' : ''}`} onClick={() => setPeriod('year')}>
                年
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div className="chip-row">
              <button type="button" className={`chip ${mode === 'expense' ? 'chip--active' : ''}`} onClick={() => setMode('expense')}>
                支出
              </button>
              <button type="button" className={`chip ${mode === 'income' ? 'chip--active' : ''}`} onClick={() => setMode('income')}>
                收入
              </button>
            </div>
            {selectedCategoryId && (
              <button type="button" className="chip chip--active" onClick={() => setSelectedCategoryId(null)}>
                {selectedCategoryName} ×
              </button>
            )}
          </div>

          {!selectedCategoryId ? (
            <div className="card" style={{ padding: '12px' }}>
              {segments.length === 0 ? (
                <div className="empty-state">暂无数据</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {segments.slice(0, 20).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="action-sheet__item"
                      style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                      onClick={() => setSelectedCategoryId(s.id)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '5px', background: s.color, flex: '0 0 auto' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                      </span>
                      <span style={{ fontWeight: 900 }}>
                        ¥{s.value.toFixed(2)} · {(s.percent * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '12px' }}>
              {filteredTxs.length === 0 ? (
                <div className="empty-state">暂无明细</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredTxs.slice(0, 60).map((tx) => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: 'var(--text)' }}>{tx.note || '—'}</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 800, color: 'var(--muted)' }}>{tx.date}</div>
                      </div>
                      <div style={{ fontWeight: 900, color: mode === 'income' ? 'var(--brand)' : '#e74c3c' }}>
                        {mode === 'income' ? '+' : '-'}¥{tx.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

