import { useEffect, useMemo, useRef, useState } from 'react'
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

export function CategoryListPage(props: {
  type: 'income' | 'expense'
  categories: Category[]
  onTypeChange: (type: 'income' | 'expense') => void
  onBack: () => void
  onOpenDetail: (categoryId: string) => void
  onAdd: () => void
  onEdit: (categoryId: string) => void
  onDelete: (categoryId: string) => void
  onReorder: (orderedIds: string[]) => void | Promise<void>
}) {
  const baseList = useMemo(() => {
    return props.categories
      .filter((c) => c.type === props.type && c.parentId === null)
      .slice()
      .sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
        const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
        if (ao !== bo) return ao - bo
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [props.categories, props.type])

  const [sorting, setSorting] = useState(false)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const pressTimerRef = useRef<number | null>(null)
  const pressRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; el: HTMLButtonElement | null } | null>(null)
  const dragStartYRef = useRef(0)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (!sorting) {
      setDraggingId(null)
      setDragOffset(0)
      return
    }
    if (orderedIds.length !== 0) return
    setOrderedIds(baseList.map((c) => c.id))
  }, [sorting, baseList, orderedIds.length])

  const list = useMemo(() => {
    if (!sorting) return baseList
    const map = new Map(props.categories.map((c) => [c.id, c] as const))
    return orderedIds.map((id) => map.get(id)).filter((x): x is Category => !!x)
  }, [sorting, baseList, orderedIds, props.categories])

  const listIds = useMemo(() => (sorting ? orderedIds : baseList.map((c) => c.id)), [sorting, orderedIds, baseList])

  const moveItem = (ids: string[], from: number, to: number) => {
    const next = ids.slice()
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    return next
  }

  const getTargetIndex = (clientY: number, ids: string[]) => {
    for (let i = 0; i < ids.length; i++) {
      const el = itemRefs.current.get(ids[i])
      if (!el) continue
      const r = el.getBoundingClientRect()
      const mid = r.top + r.height / 2
      if (clientY < mid) return i
    }
    return ids.length - 1
  }

  const startDragging = (id: string, pointerId: number, startY: number, el: HTMLButtonElement | null) => {
    suppressClickRef.current = true
    if (!sorting) {
      setSorting(true)
      setOrderedIds((prev) => (prev.length ? prev : baseList.map((c) => c.id)))
    }
    setDraggingId(id)
    dragStartYRef.current = startY
    setDragOffset(0)
    try {
      el?.setPointerCapture(pointerId)
    } catch {
    }
  }

  const handlePointerDown = (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
    pressRef.current = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, el: e.currentTarget }
    pressTimerRef.current = window.setTimeout(() => {
      const p = pressRef.current
      if (!p || p.id !== id) return
      startDragging(id, p.pointerId, p.startY, p.el)
    }, 260)
  }

  const handlePointerMove = (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pressRef.current
    if (p && p.id === id && pressTimerRef.current && !draggingId) {
      const dx = e.clientX - p.startX
      const dy = e.clientY - p.startY
      if (dx * dx + dy * dy > 64) {
        window.clearTimeout(pressTimerRef.current)
        pressTimerRef.current = null
      }
    }

    if (!draggingId) return
    if (draggingId !== id) return
    if (e.cancelable) e.preventDefault()

    const delta = e.clientY - dragStartYRef.current
    setDragOffset(delta)

    const ids = listIds.length ? listIds : orderedIds
    const from = ids.indexOf(draggingId)
    if (from < 0) return
    const to = getTargetIndex(e.clientY, ids)
    if (to === from) return

    const draggingEl = itemRefs.current.get(draggingId)
    const oldTop = draggingEl?.getBoundingClientRect().top
    const nextIds = moveItem(ids, from, to)
    setOrderedIds(nextIds)
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(draggingId)
      const newTop = el?.getBoundingClientRect().top
      if (oldTop == null || newTop == null) return
      dragStartYRef.current += newTop - oldTop
      setDragOffset(e.clientY - dragStartYRef.current)
    })
  }

  const endPress = () => {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
    pressRef.current = null
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
  }

  const handlePointerUp = (id: string) => {
    endPress()
    if (draggingId === id) {
      setDraggingId(null)
      setDragOffset(0)
    }
  }

  const handlePointerCancel = (id: string) => {
    endPress()
    if (draggingId === id) {
      setDraggingId(null)
      setDragOffset(0)
    }
  }

  return (
    <div className="add-overlay" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <div className="topbar-stack">
            <div className="topbar-row">
              <button
                type="button"
                className="topbar__iconbtn"
                onClick={() => {
                  if (sorting) {
                    setSorting(false)
                    setOrderedIds([])
                    setDraggingId(null)
                    setDragOffset(0)
                    return
                  }
                  props.onBack()
                }}
                aria-label="返回"
              >
                ‹
              </button>
              <div className="topbar-title">分类明细</div>
              <button
                type="button"
                className="topbar__iconbtn"
                aria-label={sorting ? '完成' : '排序'}
                onClick={async () => {
                  if (!sorting) {
                    setSorting(true)
                    setOrderedIds(baseList.map((c) => c.id))
                    return
                  }
                  if (draggingId) return
                  await props.onReorder(orderedIds)
                  setSorting(false)
                  setOrderedIds([])
                }}
              >
                {sorting ? '✓' : '≡'}
              </button>
            </div>

            <div className="topbar-row topbar-row--sub">
              <div className="add-overlay__seg" style={{ justifySelf: 'start', width: 'fit-content' }}>
                <button
                  type="button"
                  className={`add-overlay__segbtn ${props.type === 'expense' ? 'add-overlay__segbtn--active' : ''}`}
                  onClick={() => {
                    if (sorting) {
                      setSorting(false)
                      setOrderedIds([])
                      setDraggingId(null)
                      setDragOffset(0)
                    }
                    props.onTypeChange('expense')
                  }}
                >
                  支出
                </button>
                <button
                  type="button"
                  className={`add-overlay__segbtn ${props.type === 'income' ? 'add-overlay__segbtn--active' : ''}`}
                  onClick={() => {
                    if (sorting) {
                      setSorting(false)
                      setOrderedIds([])
                      setDraggingId(null)
                      setDragOffset(0)
                    }
                    props.onTypeChange('income')
                  }}
                >
                  收入
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="cat-scroll">
          {list.length === 0 ? (
            <div className="empty-state">暂无分类</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {list.map((c) => (
                <div
                  key={c.id}
                  className={`cat-row${sorting ? ' cat-row--sortable' : ''}${draggingId === c.id ? ' cat-row--dragging' : ''}`}
                  ref={(el) => {
                    if (el) itemRefs.current.set(c.id, el)
                    else itemRefs.current.delete(c.id)
                  }}
                  style={
                    draggingId === c.id
                      ? { transform: `translateY(${dragOffset}px)`, position: 'relative', zIndex: 5 }
                      : { transform: 'translateY(0px)' }
                  }
                >
                  <button
                    type="button"
                    className={`cat-row__main${sorting ? ' cat-row__main--drag' : ''}`}
                    onClick={() => {
                      if (sorting) return
                      if (suppressClickRef.current) return
                      props.onOpenDetail(c.id)
                    }}
                    onPointerDown={(e) => handlePointerDown(c.id, e)}
                    onPointerMove={(e) => handlePointerMove(c.id, e)}
                    onPointerUp={() => handlePointerUp(c.id)}
                    onPointerCancel={() => handlePointerCancel(c.id)}
                  >
                    <span className="cat-row__icon" style={{ background: c.color }} aria-hidden="true">
                      {getCategoryIcon(c.name, c.icon)}
                    </span>
                    <span className="cat-row__name">{c.name}</span>
                  </button>
                  <div className="cat-row__actions">
                    {sorting ? <span className="cat-row__handle">≡</span> : (
                      <>
                        <button type="button" className="btn btn-edit" onClick={() => props.onEdit(c.id)}>
                          编辑
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => props.onDelete(c.id)}>
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!sorting && (
          <button type="button" className="fab" onClick={props.onAdd} aria-label="添加分类">
            +
          </button>
        )}
      </div>
    </div>
  )
}
