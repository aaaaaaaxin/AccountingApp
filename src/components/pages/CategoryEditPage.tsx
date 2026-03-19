import { useMemo, useState } from 'react'
import type { Category } from '../../types'

const ICONS = ['🍚', '🚌', '🛍️', '🧻', '🎮', '🍪', '🍎', '🍺', '💡', '🐾', '🏥', '🏃', '👕', '📚', '💄', '🍼', '📱', '🔥', '🧾', '💼', '🎁', '🧧', '📈', '📊', '📉', '🧑‍💻', '🎀', '↩️', '📌']
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#74B9FF', '#FF7675', '#FDCB6E', '#A29BFE', '#81ECEC', '#55EFC4', '#FD79A8', '#00B894', '#636E72', '#E17055', '#00CEC9', '#6C5CE7', '#95a5a6']

type EditMode = 'createMain' | 'createChild' | 'editMain' | 'editChild'

export function CategoryEditPage(props: {
  mode: EditMode
  type: 'income' | 'expense'
  categoryId?: string
  parentId?: string | null
  categories: Category[]
  onBack: () => void
  onSave: (payload: {
    mode: EditMode
    id?: string
    type: 'income' | 'expense'
    name: string
    color: string
    icon?: string
    parentId: string | null
  }) => void | Promise<void>
}) {
  const editingCategory = useMemo(() => {
    if (!props.categoryId) return null
    return props.categories.find((c) => c.id === props.categoryId) || null
  }, [props.categories, props.categoryId])

  const [type, setType] = useState<'income' | 'expense'>(editingCategory ? editingCategory.type : props.type)
  const [name, setName] = useState<string>(editingCategory ? editingCategory.name : '')
  const [color, setColor] = useState<string>(editingCategory ? editingCategory.color : COLORS[0])
  const [icon, setIcon] = useState<string>(editingCategory?.icon || '')

  const topLevelParents = useMemo(() => {
    return props.categories
      .filter((c) => c.type === type && c.parentId === null)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [props.categories, type])

  const initialParentId = useMemo(() => {
    if (editingCategory) return editingCategory.parentId
    if (props.mode === 'createChild') return props.parentId || null
    return null
  }, [editingCategory, props.mode, props.parentId])

  const [parentId, setParentId] = useState<string | null>(initialParentId)

  const showParent = props.mode === 'createChild' || props.mode === 'editChild'
  const typeLocked = props.mode === 'editMain' || props.mode === 'editChild'

  const title =
    props.mode === 'createMain' ? '添加分类' :
    props.mode === 'createChild' ? '添加子分类' :
    props.mode === 'editMain' ? '编辑分类' :
    '编辑子分类'

  return (
    <div className="add-overlay" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <button type="button" className="topbar__iconbtn" onClick={props.onBack} aria-label="返回">
            ‹
          </button>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 900, flex: 1 }}>{title}</div>
          <button
            type="button"
            className="topbar__iconbtn"
            onClick={() =>
              props.onSave({
                mode: props.mode,
                id: editingCategory?.id,
                type,
                name,
                color,
                icon: icon || undefined,
                parentId: showParent ? parentId : null,
              })
            }
            aria-label="保存"
          >
            ✓
          </button>
        </div>

        <div className="cat-scroll">
          {!typeLocked && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '8px' }}>类型</div>
              <div className="add-overlay__seg" style={{ width: 'fit-content' }}>
                <button
                  type="button"
                  className={`add-overlay__segbtn ${type === 'expense' ? 'add-overlay__segbtn--active' : ''}`}
                  onClick={() => {
                    setType('expense')
                    setParentId(null)
                  }}
                >
                  支出
                </button>
                <button
                  type="button"
                  className={`add-overlay__segbtn ${type === 'income' ? 'add-overlay__segbtn--active' : ''}`}
                  onClick={() => {
                    setType('income')
                    setParentId(null)
                  }}
                >
                  收入
                </button>
              </div>
            </div>
          )}

          {showParent && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '8px' }}>父分类</div>
              <select
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value || null)}
                style={{ width: '100%' }}
                required
              >
                <option value="" disabled>
                  请选择父分类
                </option>
                {topLevelParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '8px' }}>名称</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.substring(0, 20))}
              placeholder="请输入分类名称"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '8px' }}>图标</div>
            <div className="icon-grid">
              {ICONS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={`icon-grid__item${icon === x ? ' icon-grid__item--active' : ''}`}
                  onClick={() => setIcon(x)}
                >
                  {x}
                </button>
              ))}
              <button type="button" className={`icon-grid__item${icon === '' ? ' icon-grid__item--active' : ''}`} onClick={() => setIcon('')}>
                ×
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '8px' }}>颜色</div>
            <div className="color-grid">
              {COLORS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={`color-grid__item${color === x ? ' color-grid__item--active' : ''}`}
                  style={{ background: x }}
                  onClick={() => setColor(x)}
                  aria-label={x}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

