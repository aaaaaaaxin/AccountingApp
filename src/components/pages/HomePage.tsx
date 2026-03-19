import { Transaction, Category } from '../../types'

export function HomePage(props: {
  monthlyStats: { income: number; expense: number; balance: number }
  transactions: Transaction[]
  categories: Category[]
  paymentMethods: { id: string; name: string }[]
  searchQuery: string
  visibleTransactions: number
  onSearchQueryChange: (value: string) => void
  onLoadMore: () => void
  onOpenDetail: (tx: Transaction) => void
  onGoAdd: () => void
}) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const getCategoryById = (id: string) => props.categories.find((c) => c.id === id)
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

  const visibleTransactions = props.transactions.slice(0, props.visibleTransactions)
  const groups = (() => {
    const byDate = new Map<string, Transaction[]>()
    const order: string[] = []
    for (const tx of visibleTransactions) {
      if (!byDate.has(tx.date)) order.push(tx.date)
      const arr = byDate.get(tx.date) || []
      arr.push(tx)
      byDate.set(tx.date, arr)
    }
    return order.map((date) => ({ date, items: byDate.get(date) || [] }))
  })()

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
    <div className="home-page">
      <div className="home-sticky">
        <section className="card card-pad" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 700 }}>
              {currentYear}年{currentMonth}月
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 700 }}>本月结余</div>
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '34px',
              fontWeight: 900,
              color: props.monthlyStats.balance >= 0 ? 'var(--brand)' : '#e74c3c',
              letterSpacing: '-0.5px',
            }}
          >
            {props.monthlyStats.balance >= 0 ? '' : '-'}¥{Math.abs(props.monthlyStats.balance).toFixed(2)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--brand-weak)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>收入</div>
              <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 900, color: '#1f2d2b' }}>
                ¥{props.monthlyStats.income.toFixed(2)}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', background: '#fff3f2', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>支出</div>
              <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 900, color: '#1f2d2b' }}>
                ¥{props.monthlyStats.expense.toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        <div className="card card-pad home-search">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <h2 style={{ margin: 0 }}>记录列表</h2>
            <div style={{ flex: 1, maxWidth: '300px' }}>
              <input
                type="text"
                placeholder="🔍 按备注搜索..."
                value={props.searchQuery}
                onChange={(e) => props.onSearchQueryChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  border: '2px solid #e8e8e8',
                  borderRadius: '12px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  background: '#fafafa',
                  minHeight: '48px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3498db'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(52, 152, 219, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e8e8e8'
                  e.currentTarget.style.background = '#fafafa'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="home-list-scroll">
        {props.transactions.length === 0 ? (
          <div className="empty-state">
            <div>{props.searchQuery.trim() ? '没有找到匹配的记录' : '暂无记录，快来添加第一条吧！'}</div>
            {!props.searchQuery.trim() && (
              <div style={{ marginTop: '12px' }}>
                <button type="button" className="btn btn-primary" onClick={props.onGoAdd}>
                  去记账
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {groups.map((group) => {
              const income = group.items.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : 0), 0)
              const expense = group.items.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0)
              const net = income - expense
              return (
                <div key={group.date} className="card day-group">
                  <div className="day-group__header">
                    <div className="day-group__title">
                      <span className="day-group__date">{formatShortDate(group.date)}</span>
                      <span className="day-group__weekday">{getWeekday(group.date)}</span>
                    </div>
                    <div className="day-group__sum">
                      <span style={{ color: net >= 0 ? 'var(--brand)' : '#e74c3c' }}>
                        {net >= 0 ? '+' : '-'}¥{Math.abs(net).toFixed(2)}
                      </span>
                      <span className="day-group__meta">
                        收入 ¥{income.toFixed(2)} · 支出 ¥{expense.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="day-group__rows">
                    {group.items.map((transaction) => {
                      const category = getCategoryById(transaction.categoryId)
                      const paymentMethod = props.paymentMethods.find((m) => m.id === transaction.paymentMethod)
                      const icon = category ? getCategoryIcon(category.name, category.icon) : '📌'
                      return (
                        <div
                          key={transaction.id}
                          className="day-row day-row--clickable"
                          role="button"
                          tabIndex={0}
                          onClick={() => props.onOpenDetail(transaction)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') props.onOpenDetail(transaction)
                          }}
                        >
                          <div className="day-row__left">
                            <div className="day-row__icon" style={{ background: category ? category.color : '#dfe8e5' }} aria-hidden="true">
                              {icon}
                            </div>
                            <div className="day-row__info">
                              <div className="day-row__line1">
                                {category && <span className="day-row__cat">{category.name}</span>}
                                {paymentMethod && <span className="day-row__pm">{paymentMethod.name}</span>}
                              </div>
                              {transaction.note && <div className="day-row__note">{transaction.note}</div>}
                              {transaction.tags && transaction.tags.length > 0 && (
                                <div className="day-row__tags">
                                  {transaction.tags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="day-row__tag">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="day-row__right">
                            <div className="day-row__amount" style={{ color: transaction.type === 'income' ? 'var(--brand)' : '#e74c3c' }}>
                              {transaction.type === 'expense' ? '-' : '+'}¥{transaction.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {props.visibleTransactions < props.transactions.length && (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <button
                  style={{
                    padding: '16px 40px',
                    fontSize: '16px',
                    fontWeight: '600',
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minHeight: '52px',
                    boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.97)'
                    e.currentTarget.style.background = '#2980b9'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.background = '#3498db'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.97)'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                  onClick={props.onLoadMore}
                  type="button"
                >
                  加载更多 ({props.visibleTransactions}/{props.transactions.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

