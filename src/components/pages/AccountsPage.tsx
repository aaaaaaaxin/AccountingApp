export function AccountsPage(props: {
  transactions: import('../../types').Transaction[]
  paymentMethods: { id: string; name: string }[]
  ledgers: import('../../types').Ledger[]
  selectedLedgerIds: string[]
  onToggleLedger: (ledgerId: string) => void | Promise<void>
  onOpenSettings: () => void
}) {
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
    <>
      <section className="form-section">
        <h2>资产概览</h2>
        <div className="chip-row" style={{ marginBottom: '12px' }}>
          {props.ledgers.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${props.selectedLedgerIds.includes(l.id) ? 'chip--active' : ''}`}
              onClick={() => props.onToggleLedger(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: '#f8f9fa', border: '1px solid #eee' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>净资产</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: lifetimeBalance >= 0 ? '#2e7d63' : '#e74c3c' }}>
              {lifetimeBalance >= 0 ? '+' : ''}¥{lifetimeBalance.toFixed(2)}
            </div>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: '#f8f9fa', border: '1px solid #eee' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>总资产</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#2c3e50' }}>¥{lifetimeIncome.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: '#f8f9fa', border: '1px solid #eee' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>总负债</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#2c3e50' }}>¥{lifetimeExpense.toFixed(2)}</div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>账户列表</h2>
        {paymentSummaries.length === 0 ? (
          <div className="empty-state">暂无账户数据</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paymentSummaries.map((acc) => (
              <div key={acc.id} style={{ padding: '14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#2c3e50' }}>{acc.name}</div>
                  <div style={{ fontWeight: 700, color: acc.balance >= 0 ? '#2e7d63' : '#e74c3c' }}>
                    {acc.balance >= 0 ? '+' : ''}¥{acc.balance.toFixed(2)}
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>收入 ¥{acc.income.toFixed(2)}</span>
                  <span>支出 ¥{acc.expense.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="form-section">
        <h2>设置</h2>
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={props.onOpenSettings}>
          打开设置
        </button>
      </section>
    </>
  )
}
