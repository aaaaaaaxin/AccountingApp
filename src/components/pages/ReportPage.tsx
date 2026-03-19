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

export function ReportPage(props: {
  header: { year: number; month: number }
  transactions: Transaction[]
  categories: Category[]
  paymentMethods: { id: string; name: string }[]
  onOpenDetail: (tx: Transaction) => void
}) {
  const getCategoryIcon = (name: string, icon?: string) => {
    if (icon) return icon
    const map: Record<string, string> = {
      餐饮: '🍚',
      出行: '🚌',
      购物: '🛍️',
      日用: '🧻',
      娱乐: '🎮',
      零食: '🍪',
      水果: '🍎',
      烟酒: '🍺',
      水电: '💡',
      宠物: '🐾',
      就医: '🏥',
      运动: '🏃',
      衣物: '👕',
      教育: '📚',
      美妆: '💄',
      育婴: '🍼',
      通讯: '📱',
      燃气: '🔥',
      手续费: '🧾',
      薪资: '💼',
      奖金: '🎁',
      补助: '🧧',
      报销: '🧾',
      红包: '🧧',
      理财: '📈',
      股票: '📊',
      基金: '📉',
      兼职: '🧑‍💻',
      礼物: '🎀',
      退款: '↩️',
      其他: '📌',
    }
    return map[name] || '📌'
  }

  const [mode, setMode] = useState<'expense' | 'income'>('expense')
  const [period, setPeriod] = useState<Period>('month')

  const range = useMemo(() => getRange(props.header, period), [period, props.header])

  const filteredTxs = useMemo(() => {
    return props.transactions
      .filter((tx) => tx.type === mode && tx.date >= range.start && tx.date <= range.end)
  }, [mode, props.transactions, range.end, range.start])

  const categoriesMap = useMemo(() => new Map(props.categories.map((c) => [c.id, c])), [props.categories])
  const paymentMap = useMemo(() => new Map(props.paymentMethods.map((m) => [m.id, m.name])), [props.paymentMethods])

  const segments = useMemo(() => {
    const sums = new Map<string, number>()
    for (const tx of filteredTxs) {
      sums.set(tx.categoryId, (sums.get(tx.categoryId) || 0) + tx.amount)
    }

    const items: { id: string; label: string; value: number; color: string }[] = []
    for (const [categoryId, value] of sums.entries()) {
      const c = categoriesMap.get(categoryId)
      items.push({ id: categoryId, label: c?.name || '未分类', value, color: c?.color || '#dfe8e5' })
    }
    items.sort((a, b) => b.value - a.value)
    const top = items.slice(0, 7)
    const rest = items.slice(7)
    if (rest.length > 0) {
      const restValue = rest.reduce((s, x) => s + x.value, 0)
      top.push({ id: 'other', label: '其他', value: restValue, color: '#cfd8d6' })
    }
    const total = top.reduce((s, x) => s + x.value, 0)
    return top
      .filter((x) => x.value > 0)
      .map((x) => ({ ...x, percent: total > 0 ? x.value / total : 0 }))
  }, [categoriesMap, filteredTxs])

  const chart = useMemo(() => {
    const size = 170
    const stroke = 18
    const paddingX = 120
    const paddingY = 44
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const cx = size / 2
    const cy = size / 2
    const startAngle = -Math.PI / 2
    let angleCursor = startAngle
    let dashCursor = 0

    const arcParts = segments.map((s) => {
      const dash = s.percent * c
      const dashOffset = c / 4 - dashCursor
      const el = (
        <circle
          key={s.id}
          cx={cx}
          cy={cy}
          r={r}
          fill="transparent"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
        />
      )
      angleCursor += s.percent * 2 * Math.PI
      dashCursor += dash
      return el
    })

    angleCursor = startAngle
    const leftX = -paddingX + 8
    const rightX = size + paddingX - 8
    const outer = r + stroke / 2
    const radialGap = 16
    const elbowGap = 16
    const calloutBase = segments
      .slice(0, Math.min(4, segments.length))
      .filter((s) => s.percent >= 0.025)
      .map((s) => {
        const mid = angleCursor + s.percent * Math.PI
        angleCursor += s.percent * 2 * Math.PI
        const cos = Math.cos(mid)
        const sin = Math.sin(mid)
        const side = cos >= 0 ? 'right' : 'left'
        const p1x = cx + cos * (outer + 2)
        const p1y = cy + sin * (outer + 2)
        const p2x = cx + cos * (outer + radialGap) + (side === 'right' ? elbowGap : -elbowGap)
        const p2y = cy + sin * (outer + radialGap)
        const p3x = side === 'right' ? rightX - 10 : leftX + 10
        const p3y = p2y
        const labelX = side === 'right' ? rightX : leftX
        const labelY = p3y
        const textAnchor = side === 'right' ? 'end' : 'start'
        const text = `${s.label} (${(s.percent * 100).toFixed(2)}%)`
        return { id: s.id, side, p1x, p1y, p2x, p2y, p3x, p3y, labelX, labelY, textAnchor, text, color: s.color }
      })

    const adjustY = (items: typeof calloutBase, side: 'left' | 'right') => {
      const list = items.filter((x) => x.side === side).sort((a, b) => a.labelY - b.labelY)
      const minGap = 14
      for (let i = 1; i < list.length; i++) {
        if (list[i].labelY - list[i - 1].labelY < minGap) {
          list[i].labelY = list[i - 1].labelY + minGap
          list[i].p3y = list[i].labelY
          list[i].p2y = list[i].labelY
        }
      }
      const minY = -paddingY + 18
      const maxY = size + paddingY - 18
      for (const x of list) {
        if (x.labelY < minY) {
          const delta = minY - x.labelY
          x.labelY = minY
          x.p3y += delta
          x.p2y += delta
        }
        if (x.labelY > maxY) {
          const delta = x.labelY - maxY
          x.labelY = maxY
          x.p3y -= delta
          x.p2y -= delta
        }
      }
    }

    adjustY(calloutBase, 'left')
    adjustY(calloutBase, 'right')

    const callouts = calloutBase.map((c) => (
      <g key={`callout_${c.id}`}>
        <polyline
          points={`${c.p1x},${c.p1y} ${c.p2x},${c.p2y} ${c.p3x},${c.p3y}`}
          fill="none"
          stroke="rgba(107, 122, 120, 0.9)"
          strokeWidth="1.2"
        />
        <text
          x={c.labelX}
          y={c.labelY}
          textAnchor={c.textAnchor as any}
          dominantBaseline="middle"
          fontSize="12"
          fontWeight="800"
          fill="rgba(107, 122, 120, 0.95)"
          stroke="rgba(255, 255, 255, 0.98)"
          strokeWidth="4"
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {c.text}
        </text>
      </g>
    ))

    return (
      <svg
        viewBox={`${-paddingX} ${-paddingY} ${size + paddingX * 2} ${size + paddingY * 2}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#eef3f1" strokeWidth={stroke} />
        {arcParts}
        {callouts}
      </svg>
    )
  }, [segments])

  const totalAmount = useMemo(() => filteredTxs.reduce((s, tx) => s + tx.amount, 0), [filteredTxs])
  const dailyAvg = useMemo(() => {
    const days = period === 'week' ? 7 : period === 'month' ? new Date(props.header.year, props.header.month, 0).getDate() : 365
    return days > 0 ? totalAmount / days : 0
  }, [period, props.header.month, props.header.year, totalAmount])

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>()
    const order: string[] = []
    for (const tx of filteredTxs) {
      if (!byDate.has(tx.date)) order.push(tx.date)
      const arr = byDate.get(tx.date) || []
      arr.push(tx)
      byDate.set(tx.date, arr)
    }
    return order.map((date) => ({ date, items: byDate.get(date) || [] }))
  }, [filteredTxs])

  const getWeekday = (date: string) => {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const d = new Date(`${date}T00:00:00`)
    return weekdays[d.getDay()] || ''
  }

  const formatShortDate = (date: string) => {
    const parts = date.split('-')
    if (parts.length !== 3) return date
    return `${parts[1]}-${parts[2]}`
  }

  return (
    <section className="form-section">
      <div className="chip-row" style={{ marginBottom: '12px' }}>
        <button type="button" className={`chip ${mode === 'expense' ? 'chip--active' : ''}`} onClick={() => setMode('expense')}>
          支出
        </button>
        <button type="button" className={`chip ${mode === 'income' ? 'chip--active' : ''}`} onClick={() => setMode('income')}>
          收入
        </button>
      </div>

      <section className="card card-pad" style={{ marginBottom: '14px' }}>
        <div className="report-card__top">
          <button type="button" className="chip chip--active" style={{ cursor: 'default' }}>
            {range.label}
          </button>
          <div className="chip-row">
            <button type="button" className={`chip ${period === 'week' ? 'chip--active' : ''}`} onClick={() => setPeriod('week')}>
              周报
            </button>
            <button type="button" className={`chip ${period === 'month' ? 'chip--active' : ''}`} onClick={() => setPeriod('month')}>
              月报
            </button>
            <button type="button" className={`chip ${period === 'year' ? 'chip--active' : ''}`} onClick={() => setPeriod('year')}>
              年报
            </button>
          </div>
        </div>

        <div className="report-card__grid">
          <div className="report-card__chart">
            {segments.length ? chart : <div className="empty-state">暂无数据</div>}
          </div>

          <div className="report-card__side">
            <div className="report-card__metrics">
              <div className="report-card__metric">
                <div className="report-card__metric-label">总{mode === 'expense' ? '支出' : '收入'}</div>
                <div className="report-card__metric-value" style={{ color: mode === 'income' ? 'var(--brand)' : '#e74c3c' }}>
                  {mode === 'income' ? '+' : '-'}¥{totalAmount.toFixed(2)}
                </div>
              </div>
              <div className="report-card__metric">
                <div className="report-card__metric-label">日均{mode === 'expense' ? '支出' : '收入'}</div>
                <div className="report-card__metric-value">¥{dailyAvg.toFixed(2)}</div>
              </div>
            </div>

            <div className="report-card__legend">
              {segments.length === 0 ? (
                <div className="report-card__empty">暂无分类数据</div>
              ) : (
                segments.slice(0, 8).map((s) => (
                  <div key={s.id} className="report-card__legend-row">
                    <span className="report-card__dot" style={{ background: s.color }} />
                    <div className="report-card__legend-main">
                      <div className="report-card__legend-line1">
                        <span className="report-card__legend-label">{s.label}</span>
                        <span className="report-card__legend-percent">{(s.percent * 100).toFixed(0)}%</span>
                      </div>
                      <div className="report-card__legend-line2">¥{s.value.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card day-group" style={{ marginBottom: '12px' }}>
        <div className="day-group__header">
          <div className="day-group__title">
            <span className="day-group__date">记录列表</span>
          </div>
          <div className="day-group__sum">
            <span style={{ color: 'var(--muted)' }}>{filteredTxs.length} 笔</span>
          </div>
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="empty-state">暂无记录</div>
      ) : (
        groups.map((group) => {
          const sum = group.items.reduce((s, tx) => s + tx.amount, 0)
          return (
            <div key={group.date} className="card day-group">
              <div className="day-group__header">
                <div className="day-group__title">
                  <span className="day-group__date">{formatShortDate(group.date)}</span>
                  <span className="day-group__weekday">{getWeekday(group.date)}</span>
                </div>
                <div className="day-group__sum">
                  <span style={{ color: mode === 'income' ? 'var(--brand)' : '#e74c3c' }}>
                    {mode === 'income' ? '+' : '-'}¥{sum.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="day-group__rows">
                {group.items.map((tx) => {
                  const c = categoriesMap.get(tx.categoryId)
                  const pm = tx.paymentMethod ? paymentMap.get(tx.paymentMethod) : undefined
                  const icon = c ? getCategoryIcon(c.name, c.icon) : '📌'
                  return (
                    <div
                      key={tx.id}
                      className="day-row day-row--clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => props.onOpenDetail(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') props.onOpenDetail(tx)
                      }}
                    >
                      <div className="day-row__left">
                        <div className="day-row__icon" style={{ background: c?.color || '#dfe8e5' }} aria-hidden="true">
                          {icon}
                        </div>
                        <div className="day-row__info">
                          <div className="day-row__line1">
                            <span className="day-row__cat">{c?.name || '未分类'}</span>
                            {pm && <span className="day-row__pm">{pm}</span>}
                          </div>
                          {tx.note && <div className="day-row__note">{tx.note}</div>}
                        </div>
                      </div>
                      <div className="day-row__right">
                        <div className="day-row__amount" style={{ color: mode === 'income' ? 'var(--brand)' : '#e74c3c' }}>
                          {mode === 'income' ? '+' : '-'}¥{tx.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
