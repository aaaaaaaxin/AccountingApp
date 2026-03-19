export type BottomNavKey = 'home' | 'report' | 'stats' | 'accounts'

type BottomNavItem = {
  key: BottomNavKey
  label: string
  icon: string
}

const LEFT: BottomNavItem[] = [
  { key: 'home', label: '首页', icon: '🏠' },
  { key: 'report', label: '报表', icon: '📈' },
]

const RIGHT: BottomNavItem[] = [
  { key: 'stats', label: '统计', icon: '📊' },
  { key: 'accounts', label: '账户', icon: '👛' },
]

export function BottomNav(props: { value: BottomNavKey; onChange: (key: BottomNavKey) => void; onAdd: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {LEFT.map((item) => {
        const active = props.value === item.key
        return (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav__item${active ? ' bottom-nav__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => props.onChange(item.key)}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}

      <button type="button" className="bottom-nav__item bottom-nav__item--fab" onClick={props.onAdd} aria-label="记账">
        <span className="bottom-nav__icon" aria-hidden="true">
          +
        </span>
        <span className="bottom-nav__label">记账</span>
      </button>

      {RIGHT.map((item) => {
        const active = props.value === item.key
        return (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav__item${active ? ' bottom-nav__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => props.onChange(item.key)}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
