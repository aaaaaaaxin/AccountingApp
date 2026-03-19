import { useEffect, useMemo, useState } from 'react'
import type { Category, Template } from '../../types'
import { useAppDialog } from '../common/AppDialogProvider'
import { TagManagePage } from './TagManagePage'

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

const evaluateAmountExpression = (input: string) => {
  const s = input.replace(/\s+/g, '')
  if (!s) return 0

  let total = 0
  let op: '+' | '-' = '+'
  let num = ''
  let dotUsed = false
  let decimals = 0

  const flush = () => {
    if (num === '' || num === '.') return false
    const v = Number(num)
    if (!Number.isFinite(v)) return false
    total = op === '+' ? total + v : total - v
    num = ''
    dotUsed = false
    decimals = 0
    return true
  }

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '+' || ch === '-') {
      if (i === 0 && num === '') {
        op = ch
        continue
      }
      if (!flush()) return null
      op = ch
      continue
    }
    if (ch === '.') {
      if (dotUsed) return null
      dotUsed = true
      num = num === '' ? '0.' : `${num}.`
      continue
    }
    if (ch >= '0' && ch <= '9') {
      if (dotUsed) {
        decimals += 1
        if (decimals > 2) return null
      }
      num += ch
      continue
    }
    return null
  }

  if (!flush()) return null
  return total
}

export function TemplateBillPage(props: {
  open: boolean
  mode: 'create' | 'edit'
  template: Template | null
  defaultType: 'income' | 'expense'
  createDraft: { amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }
  ledgerName: string
  categories: Category[]
  tags: string[]
  paymentMethods: { id: string; name: string }[]
  onClose: () => void
  onCreate: (name: string, draft: { type: 'income' | 'expense'; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => Promise<Template | null>
  onSave: (templateId: string, patch: { name: string; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => void | Promise<void>
  onDelete: (templateId: string) => void | Promise<void>
  onAddTag: (name: string) => void | Promise<void>
  onRenameTag: (oldName: string, newName: string) => void | Promise<void>
  onDeleteTag: (name: string) => void | Promise<void>
}) {
  const dialog = useAppDialog()
  const [showCategory, setShowCategory] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showTagManage, setShowTagManage] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  const [amountInput, setAmountInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [activeParentId, setActiveParentId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    if (!props.open) return
    if (props.mode === 'edit' && props.template) {
      setAmountInput(props.template.amount ? String(props.template.amount) : '0')
      setNoteInput(props.template.note || '')
      setCategoryId(props.template.categoryId)
      setTags(props.template.tags || [])
      setPaymentMethod(props.template.paymentMethod || 'cash')
      setTemplateName(props.template.name || '')
      setActiveParentId(null)
      return
    }
    setAmountInput(props.createDraft.amount ? String(props.createDraft.amount) : '0')
    setNoteInput(props.createDraft.note || '')
    setCategoryId(props.createDraft.categoryId || '')
    setTags(props.createDraft.tags || [])
    setPaymentMethod(props.createDraft.paymentMethod || 'cash')
    setTemplateName('')
    setActiveParentId(null)
  }, [props.open, props.mode, props.template, props.createDraft.amount, props.createDraft.note, props.createDraft.categoryId, props.createDraft.tags, props.createDraft.paymentMethod])

  const tplType = props.mode === 'edit' ? props.template?.type : props.defaultType
  const filtered = useMemo(() => (tplType ? props.categories.filter((c) => c.type === tplType) : []), [props.categories, tplType])
  const topLevel = useMemo(() => filtered.filter((c) => c.parentId === null), [filtered])
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

  const selectedCategory = categoryId ? filtered.find((c) => c.id === categoryId) : undefined
  const inferredParentId = selectedCategory?.parentId || (selectedCategory ? selectedCategory.id : null)
  const effectiveParentId = activeParentId ?? inferredParentId
  const children = effectiveParentId ? childrenByParent.get(effectiveParentId) || [] : []

  const paymentMethodName = props.paymentMethods.find((m) => m.id === paymentMethod)?.name || '现金'

  if (!props.open) return null

  return (
    <div className="add-overlay add-overlay--sub" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <button type="button" className="topbar__iconbtn" onClick={props.onClose} aria-label="返回">
            ‹
          </button>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 900, flex: 1, textAlign: 'center' }}>模板账单</div>
          <span style={{ width: '44px', height: '44px' }} />
        </div>

        <div className="cat-scroll">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              className="tpl-nameinput"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value.substring(0, 30))}
              placeholder="模板账单名称"
            />

            <div className="bill-row bill-row--static">
              <span className="bill-row__label">金额</span>
              <input
                className="bill-row__input"
                type="text"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.substring(0, 20))}
                placeholder="0"
                inputMode="decimal"
              />
            </div>
            <div className="bill-row bill-row--static">
              <span className="bill-row__label">备注</span>
              <input
                className="bill-row__input"
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value.substring(0, 200))}
                placeholder="可不填"
              />
            </div>
            <button type="button" className="bill-row" onClick={() => setShowCategory(true)}>
              <span className="bill-row__label">分类</span>
              <span className="bill-row__value">{selectedCategory ? selectedCategory.name : '未选择'}</span>
            </button>
            <button type="button" className="bill-row" onClick={() => setShowTags(true)}>
              <span className="bill-row__label">标签</span>
              <span className="bill-row__value">{tags.length ? tags.join('、') : '未选择'}</span>
            </button>
            <button type="button" className="bill-row" onClick={() => setShowPayment(true)}>
              <span className="bill-row__label">账户</span>
              <span className="bill-row__value">💵 {paymentMethodName}</span>
            </button>
            <div className="bill-row" style={{ cursor: 'default' }}>
              <span className="bill-row__label">账本</span>
              <span className="bill-row__value">{props.ledgerName}</span>
            </div>
          </div>
        </div>

        <div className="tpl-actions">
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: 'var(--brand)', boxShadow: '0 2px 8px rgba(46, 125, 99, 0.28)' }}
            onClick={async () => {
              const name = templateName.trim()
              if (!name) {
                await dialog.alert({ title: '提示', message: '请输入模板名称' })
                return
              }
              if (!categoryId) {
                await dialog.alert({ title: '提示', message: '请选择分类' })
                return
              }
              const v = evaluateAmountExpression(amountInput)
              if (v === null) {
                await dialog.alert({ title: '提示', message: '金额格式不正确' })
                return
              }
              const amount = Math.abs(v)
              if (amount > 999999.99) {
                await dialog.alert({ title: '提示', message: '金额不能超过 999999.99' })
                return
              }
              if (props.mode === 'create') {
                const created = await props.onCreate(name, {
                  type: props.defaultType,
                  amount,
                  note: noteInput,
                  categoryId,
                  tags,
                  paymentMethod,
                })
                if (!created) return
                dialog.toast({ message: '已创建模板', kind: 'success' })
                props.onClose()
                return
              }
              if (!props.template) return
              await props.onSave(props.template.id, {
                name,
                amount,
                note: noteInput,
                categoryId,
                tags,
                paymentMethod,
              })
              dialog.toast({ message: '已保存模板', kind: 'success' })
              props.onClose()
            }}
          >
            保存
          </button>
          {props.mode === 'edit' && props.template && (
            <button
              type="button"
              className="btn tpl-delete"
              onClick={async () => {
                const tpl = props.template
                if (!tpl) return
                const ok = await dialog.confirm({ title: '删除模板', message: `确定要删除“${tpl.name}”吗？`, okText: '删除', cancelText: '取消' })
                if (!ok) return
                await props.onDelete(tpl.id)
                dialog.toast({ message: '已删除模板', kind: 'success' })
                props.onClose()
              }}
            >
              删除
            </button>
          )}
        </div>

        {showCategory && (
          <div className="sheet-backdrop" onClick={() => setShowCategory(false)} role="dialog" aria-modal="true">
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="detail-sheet__header">
                <button type="button" className="detail-sheet__iconbtn" onClick={() => setShowCategory(false)} aria-label="关闭">
                  ×
                </button>
                <div className="detail-sheet__title">分类</div>
                <span style={{ width: '36px', height: '36px' }} />
              </div>
              <div className="detail-sheet__content">
                <div className="category-grid">
                  {topLevel.map((c) => {
                    const active = (activeParentId ?? inferredParentId) === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`category-cell${active ? ' category-cell--active' : ''}`}
                        onClick={() => {
                          setActiveParentId(c.id)
                          setCategoryId(c.id)
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
                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '8px' }}>子分类</div>
                    {children.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 800 }}>暂无子分类</div>
                    ) : (
                      <div className="chip-row">
                        {children.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`chip ${categoryId === c.id ? 'chip--active' : ''}`}
                            onClick={() => {
                              setCategoryId(c.id)
                              setShowCategory(false)
                            }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
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
                      <button
                        key={t}
                        type="button"
                        className={`chip ${tags.includes(t) ? 'chip--active' : ''}`}
                        onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                      >
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

        {showPayment && (
          <div className="sheet-backdrop" onClick={() => setShowPayment(false)} role="dialog" aria-modal="true">
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="detail-sheet__header">
                <button type="button" className="detail-sheet__iconbtn" onClick={() => setShowPayment(false)} aria-label="关闭">
                  ×
                </button>
                <div className="detail-sheet__title">账户</div>
                <span style={{ width: '36px', height: '36px' }} />
              </div>
              <div className="detail-sheet__content">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {props.paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="action-sheet__item"
                      onClick={() => {
                        setPaymentMethod(m.id)
                        setShowPayment(false)
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
