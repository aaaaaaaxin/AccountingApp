export function AccountsPage(props: {
  transactions: import('../../types').Transaction[]
  paymentMethods: { id: string; name: string }[]
  ledgers: import('../../types').Ledger[]
  selectedLedgerIds: string[]
  onToggleLedger: (ledgerId: string) => void | Promise<void>
  onOpenSettings: () => void
}) {
  const selectedLedgerCount = props.selectedLedgerIds.length
  const selectedLedgerNames = props.ledgers
    .filter((l) => props.selectedLedgerIds.includes(l.id))
    .map((l) => l.name)
    .join('、')

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
      <section className="card card-pad accounts-card">
        <div className="accounts-card__top">
          <div>
            <div className="accounts-card__title">资产概览</div>
            <div className="accounts-card__sub">
              {selectedLedgerCount === 0 ? '未选择账本' : `已选 ${selectedLedgerCount} 个账本：${selectedLedgerNames}`}
            </div>
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
                  <div className="accounts-item__icon">{acc.name.slice(0, 1)}</div>
                  <div className="accounts-item__meta">
                    <div className="accounts-item__name">{acc.name}</div>
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
