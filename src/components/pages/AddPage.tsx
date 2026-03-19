import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Category, Template } from '../../types'
import { TagManagePage } from './TagManagePage'
import { TemplateManagePage } from './TemplateManagePage'

export function AddPage(props: {
  ledgerName: string
  title: string
  formData: {
    type: 'income' | 'expense'
    amount: string
    categoryId: string
    date: string
    note: string
    paymentMethod: string
    tags: string[]
  }
  categories: Category[]
  paymentMethods: { id: string; name: string }[]
  tags: string[]
  templates: Template[]
  amountPreview: number | null
  editing: boolean
  onSave: (behavior: 'close' | 'stay') => void | Promise<void>
  onFormChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onTypeChange: (type: 'income' | 'expense') => void
  onKeypadPress: (key: string) => void
  onToggleTag: (tag: string) => void
  onCategorySelect: (categoryId: string) => void
  onQuickSetDate: (date: string) => void
  onUseTemplate: (tpl: Template) => void
  onOpenCategoryManagement: () => void
  onAddSubcategory: (parentId: string) => void
  onUpdateTemplate: (templateId: string, patch: { name: string; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => void | Promise<void>
  onDeleteTemplate: (templateId: string) => void | Promise<void>
  onCreateTemplate: (name: string, draft: { type: 'income' | 'expense'; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => Promise<Template | null>
  onAddTag: (name: string) => void | Promise<void>
  onRenameTag: (oldName: string, newName: string) => void | Promise<void>
  onDeleteTag: (name: string) => void | Promise<void>
  onCancelEdit: () => void
  onClose: () => void
  onOpenLedger: () => void
}) {
  const [activeParentId, setActiveParentId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showTagManage, setShowTagManage] = useState(false)
  const [showTemplateManage, setShowTemplateManage] = useState(false)

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

  const filtered = useMemo(() => props.categories.filter((c) => c.type === props.formData.type), [props.categories, props.formData.type])
  const topLevel = useMemo(() => {
    return filtered
      .filter((c) => c.parentId === null)
      .slice()
      .sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
        const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
        if (ao !== bo) return ao - bo
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [filtered])
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Category[]>()
    for (const c of filtered) {
      if (c.parentId) {
        const arr = m.get(c.parentId) || []
        arr.push(c)
        m.set(c.parentId, arr)
      }
    }
    return m
  }, [filtered])

  const selectedCategory = props.formData.categoryId ? filtered.find((c) => c.id === props.formData.categoryId) : undefined
  const inferredParentId = selectedCategory?.parentId || (selectedCategory ? selectedCategory.id : null)
  const effectiveParentId = activeParentId ?? inferredParentId
  const children = useMemo(() => {
    if (!effectiveParentId) return []
    return (childrenByParent.get(effectiveParentId) || [])
      .slice()
      .sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
        const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
        if (ao !== bo) return ao - bo
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [childrenByParent, effectiveParentId])

  return (
    <div className="add-overlay" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <button type="button" className="topbar__ledger" onClick={props.onOpenLedger}>
            {props.ledgerName} <span aria-hidden="true">▾</span>
          </button>
          <div className="add-overlay__seg">
            <button type="button" className={`add-overlay__segbtn ${props.formData.type === 'expense' ? 'add-overlay__segbtn--active' : ''}`} onClick={() => props.onTypeChange('expense')}>
              支出
            </button>
            <button type="button" className={`add-overlay__segbtn ${props.formData.type === 'income' ? 'add-overlay__segbtn--active' : ''}`} onClick={() => props.onTypeChange('income')}>
              收入
            </button>
          </div>
          <button type="button" className="add-overlay__close" onClick={props.onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <form
          className="add-overlay__form"
          onSubmit={(e) => {
            e.preventDefault()
            props.onSave(props.editing ? 'close' : 'close')
          }}
        >
          <div className="add-overlay__scroll">
            <div className="card card-pad" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ fontWeight: 900, color: 'var(--text)' }}>分类</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 800 }}>{selectedCategory ? selectedCategory.name : '未选择'}</div>
                  <button type="button" className="chip" onClick={props.onOpenCategoryManagement}>
                    分类管理
                  </button>
                </div>
              </div>

              <div className="category-grid">
                {topLevel.map((c) => {
                  const hasChildren = (childrenByParent.get(c.id) || []).length > 0
                  const active = effectiveParentId === c.id || selectedCategory?.id === c.id || selectedCategory?.parentId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`category-cell ${active ? 'category-cell--active' : ''}`}
                      onClick={() => {
                        if (hasChildren) {
                          setActiveParentId(c.id)
                        } else {
                          setActiveParentId(null)
                          props.onCategorySelect(c.id)
                        }
                      }}
                    >
                      <span className="category-cell__icon" style={{ background: c.color }} aria-hidden="true">
                        {getCategoryIcon(c.name, c.icon)}
                      </span>
                      <span className="category-cell__label">{c.name}</span>
                    </button>
                  )
                })}
              </div>

              {effectiveParentId && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900 }}>子分类</div>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => props.onAddSubcategory(effectiveParentId)}
                      disabled={!effectiveParentId}
                    >
                      添加子类
                    </button>
                  </div>
                  {children.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 800 }}>暂无子分类</div>
                  ) : (
                    <div className="chip-row">
                      {children.map((c) => (
                        <button key={c.id} type="button" className={`chip ${props.formData.categoryId === c.id ? 'chip--active' : ''}`} onClick={() => props.onCategorySelect(c.id)}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="add-overlay__bottom">
            <div className="add-quick">
              <select className="add-quick__select" name="paymentMethod" value={props.formData.paymentMethod} onChange={props.onFormChange}>
                {props.paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input className="add-quick__date" type="date" name="date" required value={props.formData.date} onChange={props.onFormChange} />
              <button type="button" className="add-quick__btn" onClick={() => setShowTemplates(true)}>
                模板
              </button>
              <button type="button" className="add-quick__btn" onClick={() => setShowTags(true)}>
                标签
              </button>
            </div>

            <div className="add-inputrow">
              <textarea
                className="add-inputrow__note"
                name="note"
                value={props.formData.note}
                onChange={props.onFormChange}
                placeholder="备注"
                rows={1}
              />
              <div className="add-amountwrap">
                <input
                  className="add-inputrow__amount"
                  type="text"
                  name="amount"
                  value={props.formData.amount}
                  onChange={props.onFormChange}
                  placeholder="金额"
                  inputMode="decimal"
                />
                {props.amountPreview !== null && /[+-]/.test(props.formData.amount) && (
                  <div className="add-amountwrap__preview">
                    = {props.amountPreview < 0 ? '-' : ''}¥{Math.abs(props.amountPreview).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div className="add-keypad">
              {(props.editing
                ? ['1', '2', '3', '⌫', '4', '5', '6', '+', '7', '8', '9', '-', '.', '0', '取消', '保存']
                : ['1', '2', '3', '⌫', '4', '5', '6', '+', '7', '8', '9', '-', '.', '0', '再记', '记录']
              ).map((k) => {
                const isAction = k === '再记' || k === '记录' || k === '取消' || k === '保存'
                const isPrimary = k === '记录' || k === '保存'
                const className = isAction
                  ? `add-keypad__action${isPrimary ? ' add-keypad__action--primary' : ''}`
                  : `add-keypad__key${k === '⌫' ? ' add-keypad__key--danger' : ''}`

                const onClick = () => {
                  if (k === '再记') return props.onSave('stay')
                  if (k === '记录') return props.onSave('close')
                  if (k === '取消') return props.onCancelEdit()
                  if (k === '保存') return props.onSave('close')
                  return props.onKeypadPress(k)
                }

                return (
                  <button key={k} type="button" className={className} onClick={onClick}>
                    {k}
                  </button>
                )
              })}
            </div>
          </div>
        </form>

        {showTemplates && (
          <div className="sheet-backdrop" onClick={() => setShowTemplates(false)} role="dialog" aria-modal="true">
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="detail-sheet__header">
                <button type="button" className="detail-sheet__iconbtn" onClick={() => setShowTemplates(false)} aria-label="关闭">
                  ×
                </button>
                <div className="detail-sheet__title">模板</div>
                <button
                  type="button"
                  className="detail-sheet__iconbtn"
                  aria-label="设置"
                  onClick={() => {
                    setShowTemplates(false)
                    setShowTemplateManage(true)
                  }}
                >
                  ⚙
                </button>
              </div>
              <div className="detail-sheet__content">
                {props.templates.length === 0 ? (
                  <div className="empty-state">暂无模板</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {props.templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="action-sheet__item"
                        onClick={() => {
                          props.onUseTemplate(tpl)
                          setShowTemplates(false)
                        }}
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showTags && (
          <div className="sheet-backdrop" onClick={() => setShowTags(false)} role="dialog" aria-modal="true">
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="detail-sheet__header">
                <button type="button" className="detail-sheet__iconbtn" onClick={() => setShowTags(false)} aria-label="关闭">
                  ×
                </button>
                <div className="detail-sheet__title">标签</div>
                <button
                  type="button"
                  className="detail-sheet__iconbtn"
                  aria-label="设置"
                  onClick={() => {
                    setShowTags(false)
                    setShowTagManage(true)
                  }}
                >
                  ⚙
                </button>
              </div>
              <div className="detail-sheet__content">
                {props.tags.length === 0 ? (
                  <div className="empty-state">暂无标签</div>
                ) : (
                  <div className="chip-row">
                    {props.tags.map((t) => (
                      <button key={t} type="button" className={`chip ${props.formData.tags.includes(t) ? 'chip--active' : ''}`} onClick={() => props.onToggleTag(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <TagManagePage
          open={showTagManage}
          tags={props.tags}
          onClose={() => {
            setShowTagManage(false)
            setShowTags(true)
          }}
          onAdd={props.onAddTag}
          onRename={props.onRenameTag}
          onDelete={props.onDeleteTag}
        />

        <TemplateManagePage
          open={showTemplateManage}
          templates={props.templates}
          defaultType={props.formData.type}
          createDraft={{
            amount:
              props.amountPreview !== null
                ? Math.abs(props.amountPreview)
                : Number.isFinite(Number(props.formData.amount))
                  ? Math.abs(Number(props.formData.amount))
                  : 0,
            note: props.formData.note,
            categoryId: props.formData.categoryId,
            tags: props.formData.tags,
            paymentMethod: props.formData.paymentMethod,
          }}
          ledgerName={props.ledgerName}
          categories={props.categories}
          tags={props.tags}
          paymentMethods={props.paymentMethods}
          onClose={() => {
            setShowTemplateManage(false)
            setShowTemplates(true)
          }}
          onCreate={props.onCreateTemplate}
          onUpdate={props.onUpdateTemplate}
          onDelete={props.onDeleteTemplate}
          onAddTag={props.onAddTag}
          onRenameTag={props.onRenameTag}
          onDeleteTag={props.onDeleteTag}
        />
      </div>
    </div>
  )
}
