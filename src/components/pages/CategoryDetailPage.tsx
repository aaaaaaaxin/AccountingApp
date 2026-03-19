import type { Category } from '../../types'

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

export function CategoryDetailPage(props: {
  categoryId: string
  categories: Category[]
  onBack: () => void
  onEditMain: (categoryId: string) => void
  onEditChild: (categoryId: string) => void
  onDeleteChild: (categoryId: string) => void
  onAddChild: (parentId: string) => void
}) {
  const parent = props.categories.find((c) => c.id === props.categoryId) || null
  const children = parent
    ? props.categories
        .filter((c) => c.parentId === parent.id)
        .slice()
        .sort((a, b) => {
          const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
          const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
          if (ao !== bo) return ao - bo
          return b.createdAt.localeCompare(a.createdAt)
        })
    : []

  return (
    <div className="add-overlay" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <button type="button" className="topbar__iconbtn" onClick={props.onBack} aria-label="返回">
            ‹
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <div style={{ color: 'white', fontSize: '16px', fontWeight: 900 }}>分类详情</div>
            {parent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="cat-row__icon" style={{ background: parent.color }} aria-hidden="true">
                  {getCategoryIcon(parent.name, parent.icon)}
                </span>
                <div style={{ color: 'white', fontSize: '14px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {parent.name}
                </div>
              </div>
            )}
          </div>
          {parent ? (
            <button type="button" className="topbar__iconbtn" onClick={() => props.onEditMain(parent.id)} aria-label="编辑主分类">
              ⋯
            </button>
          ) : (
            <span style={{ width: '44px', height: '44px' }} />
          )}
        </div>

        <div className="cat-scroll">
          {!parent ? (
            <div className="empty-state">分类不存在</div>
          ) : children.length === 0 ? (
            <div className="empty-state">暂无子分类</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {children.map((c) => (
                <div key={c.id} className="cat-row">
                  <div className="cat-row__main" style={{ cursor: 'default' }}>
                    <span className="cat-row__icon" style={{ background: c.color }} aria-hidden="true">
                      {getCategoryIcon(c.name, c.icon)}
                    </span>
                    <span className="cat-row__name">{c.name}</span>
                  </div>
                  <div className="cat-row__actions">
                    <button type="button" className="btn btn-edit" onClick={() => props.onEditChild(c.id)}>
                      编辑
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => props.onDeleteChild(c.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {parent && (
          <button type="button" className="fab" onClick={() => props.onAddChild(parent.id)} aria-label="添加子分类">
            +
          </button>
        )}
      </div>
    </div>
  )
}
