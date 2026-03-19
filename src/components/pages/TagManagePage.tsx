import { useEffect, useMemo, useState } from 'react'
import { useAppDialog } from '../common/AppDialogProvider'

type EditMode = 'add' | 'edit'

export function TagManagePage(props: {
  open: boolean
  tags: string[]
  onClose: () => void
  onAdd: (name: string) => void | Promise<void>
  onRename: (oldName: string, newName: string) => void | Promise<void>
  onDelete: (name: string) => void | Promise<void>
}) {
  const dialog = useAppDialog()
  const [edit, setEdit] = useState<null | { mode: EditMode; initialName?: string }>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!edit) return
    setValue(edit.mode === 'edit' ? edit.initialName || '' : '')
  }, [edit])

  const sorted = useMemo(() => props.tags.slice().sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')), [props.tags])

  if (!props.open) return null

  return (
    <div className="add-overlay add-overlay--sub" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <button type="button" className="topbar__iconbtn" onClick={props.onClose} aria-label="返回">
            ‹
          </button>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 900, flex: 1, textAlign: 'center' }}>标签管理</div>
          <span style={{ width: '44px', height: '44px' }} />
        </div>

        <div className="cat-scroll">
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 900, marginBottom: '10px' }}>轻点修改，长按拖动排序</div>
          {sorted.length === 0 ? (
            <div className="empty-state">暂无标签</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sorted.map((t) => (
                <div key={t} className="cat-row">
                  <div className="cat-row__main" style={{ cursor: 'default' }}>
                    <span className="cat-row__icon" style={{ background: 'var(--brand)' }} aria-hidden="true">
                      #
                    </span>
                    <span className="cat-row__name">{t}</span>
                  </div>
                  <div className="cat-row__actions">
                    <button type="button" className="btn btn-edit" onClick={() => setEdit({ mode: 'edit', initialName: t })}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={async () => {
                        const ok = await dialog.confirm({ title: '删除标签', message: `确定要删除“${t}”吗？`, okText: '删除', cancelText: '取消' })
                        if (!ok) return
                        await props.onDelete(t)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="fab" onClick={() => setEdit({ mode: 'add' })} aria-label="添加标签">
          +
        </button>

        {edit && (
          <div className="dialog-backdrop" onClick={() => setEdit(null)} role="dialog" aria-modal="true">
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <div className="dialog__title">{edit.mode === 'add' ? '添加标签' : '修改标签'}</div>
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="输入标签"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    fontSize: '16px',
                    fontWeight: 900,
                    outline: 'none',
                  }}
                />
              </div>
              <div className="dialog__actions">
                <button type="button" className="dialog__btn" onClick={() => setEdit(null)}>
                  取消
                </button>
                <button
                  type="button"
                  className="dialog__btn dialog__btn--primary"
                  onClick={async () => {
                    const next = value.trim()
                    if (!next) {
                      dialog.toast({ message: '标签不能为空', kind: 'error' })
                      return
                    }
                    if (edit.mode === 'add') {
                      if (props.tags.includes(next)) {
                        dialog.toast({ message: '标签已存在', kind: 'info' })
                        return
                      }
                      await props.onAdd(next)
                      setEdit(null)
                      return
                    }
                    const oldName = edit.initialName || ''
                    if (!oldName) return
                    if (oldName === next) {
                      setEdit(null)
                      return
                    }
                    if (props.tags.includes(next)) {
                      dialog.toast({ message: '标签已存在', kind: 'info' })
                      return
                    }
                    await props.onRename(oldName, next)
                    setEdit(null)
                  }}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
