import { useEffect, useMemo, useState } from 'react'
import type { Category, Transaction } from '../../types'

type Mode = 'menu' | 'confirm_delete'

export function TransactionDetailSheet(props: {
  open: boolean
  transaction: Transaction
  category?: Category
  paymentMethodName?: string
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>('menu')
  const [showActions, setShowActions] = useState(false)

  useEffect(() => {
    if (!props.open) return
    setMode('menu')
    setShowActions(false)
  }, [props.open, props.transaction.id])

  useEffect(() => {
    if (!props.open) return
    const scrollY = window.scrollY || 0
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflowY: body.style.overflowY,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflowY = 'scroll'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      body.style.overflowY = prev.overflowY
      window.scrollTo(0, scrollY)
    }
  }, [props.open])

  const amountText = useMemo(() => {
    const sign = props.transaction.type === 'expense' ? '-' : '+'
    return `${sign}¥${props.transaction.amount.toFixed(2)}`
  }, [props.transaction.amount, props.transaction.type])

  const amountColor = props.transaction.type === 'income' ? 'var(--brand)' : '#e74c3c'

  const tags = props.transaction.tags || []

  if (!props.open) return null

  return (
    <div className="sheet-backdrop" onClick={props.onClose} role="dialog" aria-modal="true">
      <div className="sheet sheet--detail" onClick={(e) => e.stopPropagation()}>
        <div className="detail-sheet__header">
          <button type="button" className="detail-sheet__iconbtn" onClick={props.onClose} aria-label="关闭">
            ×
          </button>
          <div className="detail-sheet__title">详情</div>
          <button
            type="button"
            className="detail-sheet__iconbtn"
            onClick={() => setShowActions(true)}
            aria-label="更多"
          >
            ⋯
          </button>
        </div>

        <div className="detail-sheet__content">
          <div className="detail-sheet__amount" style={{ color: amountColor }}>
            {amountText}
          </div>

          <div className="detail-sheet__meta">
            <div className="detail-sheet__row">
              <div className="detail-sheet__label">分类</div>
              <div className="detail-sheet__value">
                {props.category ? props.category.name : '未分类'}
              </div>
            </div>
            <div className="detail-sheet__row">
              <div className="detail-sheet__label">日期</div>
              <div className="detail-sheet__value">{props.transaction.date}</div>
            </div>
            <div className="detail-sheet__row">
              <div className="detail-sheet__label">支付方式</div>
              <div className="detail-sheet__value">{props.paymentMethodName || '未设置'}</div>
            </div>
            <div className="detail-sheet__row">
              <div className="detail-sheet__label">备注</div>
              <div className="detail-sheet__value detail-sheet__value--wrap">
                {props.transaction.note || '—'}
              </div>
            </div>
            <div className="detail-sheet__row">
              <div className="detail-sheet__label">标签</div>
              <div className="detail-sheet__value">
                {tags.length === 0 ? (
                  <span>—</span>
                ) : (
                  <div className="detail-sheet__tags">
                    {tags.map((t) => (
                      <span key={t} className="detail-sheet__tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="sheet-backdrop sheet-backdrop--inner" onClick={() => setShowActions(false)}>
            <div className="sheet sheet--actions" onClick={(e) => e.stopPropagation()}>
              <div className="sheet__title">操作</div>

              {mode === 'menu' && (
                <div className="action-sheet__list">
                  <button
                    type="button"
                    className="action-sheet__item"
                    onClick={() => {
                      setShowActions(false)
                      props.onEdit()
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="action-sheet__item action-sheet__item--danger"
                    onClick={() => setMode('confirm_delete')}
                  >
                    删除
                  </button>
                  <button type="button" className="action-sheet__item" onClick={() => setShowActions(false)}>
                    取消
                  </button>
                </div>
              )}

              {mode === 'confirm_delete' && (
                <div className="action-sheet__list">
                  <div className="action-sheet__hint">确定要删除这条记录吗？删除后会进入回收站。</div>
                  <button
                    type="button"
                    className="action-sheet__item action-sheet__item--danger"
                    onClick={async () => {
                      await props.onDelete()
                      setShowActions(false)
                      props.onClose()
                    }}
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    className="action-sheet__item"
                    onClick={() => {
                      setMode('menu')
                    }}
                  >
                    返回
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
