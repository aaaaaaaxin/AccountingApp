import { useMemo, useState } from 'react'
import type { Category, Transaction } from '../../types'

type Period = 'week' | 'month' | 'year'

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
  const base = new Date()
  const day = (base.getDay() + 6) % 7
  const startDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6)
  const start = toDateStr(startDate)
  const end = toDateStr(endDate)
  return { start, end, label: rangeLabel(start, end) }
}

export function StatsPage(props: {
  header: { year: number; month: number }
  monthlyStats: { income: number; expense: number; balance: number }
  transactions: Transaction[]
  categories: Category[]
  paymentMethods: { id: string; name: string }[]
}) {
  const [period, setPeriod] = useState<Period>('month')

  const range = useMemo(() => getRange(props.header, period), [period, props.header])

  const rangeTransactions = useMemo(() => {
    return props.transactions.filter((tx) => tx.date >= range.start && tx.date <= range.end)
  }, [props.transactions, range.end, range.start])

  const summary = useMemo(() => {
    if (period === 'month') return props.monthlyStats
    const income = rangeTransactions.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : 0), 0)
    const expense = rangeTransactions.reduce((s, tx) => s + (tx.type === 'expense' ? tx.amount : 0), 0)
    return { income, expense, balance: income - expense }
  }, [period, props.monthlyStats, rangeTransactions])

  const paymentStats = useMemo(() => {
    const base = props.paymentMethods.map((m) => ({ id: m.id, name: m.name, income: 0, expense: 0 }))
    const map = new Map(base.map((x) => [x.id, x]))
    const unknownId = 'unknown'
    for (const tx of rangeTransactions) {
      const id = tx.paymentMethod || unknownId
      if (!map.has(id)) {
        map.set(id, { id, name: id === unknownId ? '未设置' : id, income: 0, expense: 0 })
      }
      const row = map.get(id)!
      if (tx.type === 'income') row.income += tx.amount
      else row.expense += tx.amount
    }
    const list = Array.from(map.values()).map((x) => ({ ...x, balance: x.income - x.expense }))
    list.sort((a, b) => Math.abs(b.income + b.expense) - Math.abs(a.income + a.expense))
    return list
  }, [props.paymentMethods, rangeTransactions])

  return (
    <>
      <section className="card card-pad" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontWeight: 900, color: 'var(--text)' }}>周期</div>
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
      </section>

      <section className="card card-pad" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 700 }}>{range.label}</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 700 }}>结余</div>
        </div>
        <div
          style={{
            marginTop: '8px',
            fontSize: '34px',
            fontWeight: 900,
            color: summary.balance >= 0 ? 'var(--brand)' : '#e74c3c',
            letterSpacing: '-0.5px',
          }}
        >
          {summary.balance >= 0 ? '' : '-'}¥{Math.abs(summary.balance).toFixed(2)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--brand-weak)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>收入</div>
            <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 900, color: '#1f2d2b' }}>
              ¥{summary.income.toFixed(2)}
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '12px', background: '#fff3f2', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>支出</div>
            <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 900, color: '#1f2d2b' }}>
              ¥{summary.expense.toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      <section className="card card-pad" style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 900, color: 'var(--text)', marginBottom: '12px' }}>支付方式</div>
        {paymentStats.every((x) => x.income === 0 && x.expense === 0) ? (
          <div className="empty-state">暂无数据</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paymentStats
              .filter((x) => x.income !== 0 || x.expense !== 0)
              .map((x) => (
                <div key={x.id} style={{ padding: '14px', borderRadius: '12px', background: '#fbfcfb', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, color: 'var(--text)' }}>{x.name}</div>
                    <div style={{ fontWeight: 900, color: x.balance >= 0 ? 'var(--brand)' : '#e74c3c' }}>
                      {x.balance >= 0 ? '+' : ''}¥{x.balance.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', fontWeight: 800 }}>
                    <span>收入 ¥{x.income.toFixed(2)}</span>
                    <span>支出 ¥{x.expense.toFixed(2)}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  )
}
