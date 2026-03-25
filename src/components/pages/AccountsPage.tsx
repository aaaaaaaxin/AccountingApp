import { useState } from 'react'

export function AccountsPage(props: {
  transactions: import('../../types').Transaction[]
  paymentMethods: { id: string; name: string }[]
  ledgers: import('../../types').Ledger[]
  selectedLedgerIds: string[]
  onToggleLedger: (ledgerId: string) => void | Promise<void>
  onOpenSettings: () => void
}) {
  const parsePaymentName = (raw: string) => {
    const m = raw.trim().match(/^(\S+)\s+(.*)$/)
    if (!m) return { icon: raw.trim().slice(0, 1) || '💳', label: raw.trim() || '未设置' }
    return { icon: m[1], label: m[2] || raw.trim() }
  }

  const getPaymentVisual = (id: string, rawName: string) => {
    const { icon, label } = parsePaymentName(rawName)
    const base = {
      cash: { bg: 'rgba(39, 174, 96, 0.12)', border: 'rgba(39, 174, 96, 0.18)', fg: '#1e8449' },
      wechat: { bg: 'rgba(46, 204, 113, 0.12)', border: 'rgba(46, 204, 113, 0.18)', fg: '#27ae60' },
      alipay: { bg: 'rgba(52, 152, 219, 0.12)', border: 'rgba(52, 152, 219, 0.18)', fg: '#2980b9' },
      card: { bg: 'rgba(155, 89, 182, 0.12)', border: 'rgba(155, 89, 182, 0.18)', fg: '#8e44ad' },
      credit: { bg: 'rgba(241, 196, 15, 0.14)', border: 'rgba(241, 196, 15, 0.22)', fg: '#b8860b' },
    } as Record<string, { bg: string; border: string; fg: string }>
    const theme = base[id] || { bg: 'rgba(22, 119, 255, 0.12)', border: 'rgba(22, 119, 255, 0.18)', fg: '#1677ff' }
    return { icon, label, ...theme }
  }

  const selectedLedgerCount = props.selectedLedgerIds.length
  const selectedLedgerNames = props.ledgers
    .filter((l) => props.selectedLedgerIds.includes(l.id))
    .map((l) => l.name)
    .join('、')
  const [ledgerSummaryExpanded, setLedgerSummaryExpanded] = useState(false)
  const ledgerSummaryText =
    selectedLedgerCount === 0 ? '未选择账本' : `已选 ${selectedLedgerCount} 个账本：${selectedLedgerNames || '—'}`
  const ledgerSummaryNeedFold = ledgerSummaryText.length >= 22

  const lifetimeIncome = props.transactions.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : 0), 0)
  const lifetimeExpense = props.transactions.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0)
  const lifetimeBalance = lifetimeIncome - lifetimeExpense

  const paymentSummaries = props.paymentMethods
    .map((pm) => {
      const income = props.transactions.reduce((sum, tx) => sum + (tx.type === 'income' && tx.paymentMethod === pm.id ? tx.amount : 0), 0)
      const expense = props.transactions.reduce((sum, tx) => sum + (tx.type === 'expense' && tx.paymentMethod === pm.id ? tx.amount : 0), 0)
      return { id: pm.id, name: pm.name, income, expense, balance: income - expense }
    })
    .filter((x) => x.income !== 0 || x.expense !== 0)

  return (
    <div className="accounts-page">
      <section className="card card-pad accounts-card accounts-card--hero">
        <div className="accounts-card__top">
          <div>
            <div className="accounts-card__title">资产概览</div>
            <button
              type="button"
              className={`accounts-card__sub accounts-subbtn ${ledgerSummaryExpanded ? 'accounts-subbtn--open' : ''}`}
              onClick={() => {
                if (!ledgerSummaryNeedFold) return
                setLedgerSummaryExpanded((v) => !v)
              }}
              style={{ cursor: ledgerSummaryNeedFold ? 'pointer' : 'default' }}
              aria-label="已选账本"
            >
              <span className={ledgerSummaryNeedFold && !ledgerSummaryExpanded ? 'accounts-subbtn__text--clamp' : ''}>{ledgerSummaryText}</span>
              {ledgerSummaryNeedFold && <span className="accounts-subbtn__chev">{ledgerSummaryExpanded ? '⌃' : '⌄'}</span>}
            </button>
          </div>
          <button type="button" className="accounts-gear" onClick={props.onOpenSettings} aria-label="打开设置">
            ⚙︎
          </button>
        </div>

        <div className="accounts-ledger-row">
          {props.ledgers.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip accounts-ledger-chip ${props.selectedLedgerIds.includes(l.id) ? 'chip--active' : ''}`}
              onClick={() => props.onToggleLedger(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className="accounts-kpis">
          <div className="accounts-kpi">
            <div className="accounts-kpi__label">净资产</div>
            <div className="accounts-kpi__value" style={{ color: lifetimeBalance >= 0 ? '#2e7d63' : '#e74c3c' }}>
              {lifetimeBalance >= 0 ? '+' : ''}¥{lifetimeBalance.toFixed(2)}
            </div>
          </div>
          <div className="accounts-kpi">
            <div className="accounts-kpi__label">总资产</div>
            <div className="accounts-kpi__value">¥{lifetimeIncome.toFixed(2)}</div>
          </div>
          <div className="accounts-kpi">
            <div className="accounts-kpi__label">总负债</div>
            <div className="accounts-kpi__value">¥{lifetimeExpense.toFixed(2)}</div>
          </div>
        </div>
      </section>

      <section className="card card-pad accounts-card">
        <div className="accounts-card__title">账户列表</div>
        {paymentSummaries.length === 0 ? (
          <div className="accounts-empty">暂无账户数据</div>
        ) : (
          <div className="accounts-list">
            {paymentSummaries.map((acc) => (
              <div key={acc.id} className="accounts-item">
                <div className="accounts-item__left">
                  {(() => {
                    const v = getPaymentVisual(acc.id, acc.name)
                    return (
                      <div className="accounts-item__icon" style={{ background: v.bg, borderColor: v.border, color: v.fg }}>
                        {v.icon}
                      </div>
                    )
                  })()}
                  <div className="accounts-item__meta">
                    <div className="accounts-item__name">{getPaymentVisual(acc.id, acc.name).label}</div>
                    <div className="accounts-item__sub">
                      <span className="accounts-pill accounts-pill--in">收入 ¥{acc.income.toFixed(2)}</span>
                      <span className="accounts-pill accounts-pill--out">支出 ¥{acc.expense.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="accounts-item__right" style={{ color: acc.balance >= 0 ? '#2e7d63' : '#e74c3c' }}>
                  {acc.balance >= 0 ? '+' : ''}¥{acc.balance.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
