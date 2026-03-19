import { useMemo, useState } from 'react'
import type { Category, Template } from '../../types'
import { useAppDialog } from '../common/AppDialogProvider'
import { TemplateBillPage } from './TemplateBillPage'

type BillState =
  | { open: false }
  | { open: true; mode: 'create'; template: null }
  | { open: true; mode: 'edit'; template: Template }

export function TemplateManagePage(props: {
  open: boolean
  templates: Template[]
  defaultType: 'income' | 'expense'
  createDraft: { amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }
  ledgerName: string
  categories: Category[]
  tags: string[]
  paymentMethods: { id: string; name: string }[]
  onClose: () => void
  onCreate: (name: string, draft: { type: 'income' | 'expense'; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => Promise<Template | null>
  onUpdate: (templateId: string, patch: { name: string; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => void | Promise<void>
  onDelete: (templateId: string) => void | Promise<void>
  onAddTag: (name: string) => void | Promise<void>
  onRenameTag: (oldName: string, newName: string) => void | Promise<void>
  onDeleteTag: (name: string) => void | Promise<void>
}) {
  const dialog = useAppDialog()
  const [bill, setBill] = useState<BillState>({ open: false })

  const sorted = useMemo(() => props.templates.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [props.templates])

  if (!props.open) return null

  return (
    <div className="add-overlay add-overlay--sub" role="dialog" aria-modal="true">
      <div className="add-overlay__panel">
        <div className="add-overlay__top">
          <button type="button" className="topbar__iconbtn" onClick={props.onClose} aria-label="返回">
            ‹
          </button>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 900, flex: 1, textAlign: 'center' }}>模板管理</div>
          <span style={{ width: '44px', height: '44px' }} />
        </div>

        <div className="cat-scroll">
          {sorted.length === 0 ? (
            <div className="empty-state">
              暂无模板
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: 'var(--brand)', boxShadow: '0 2px 8px rgba(46, 125, 99, 0.28)', width: 'auto', padding: '12px 18px' }}
                  onClick={() => setBill({ open: true, mode: 'create', template: null })}
                >
                  创建模板
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sorted.map((t) => (
                <div key={t.id} className="cat-row">
                  <div className="cat-row__main" style={{ cursor: 'default' }}>
                    <span className="cat-row__icon" style={{ background: 'var(--brand)' }} aria-hidden="true">
                      🧾
                    </span>
                    <span className="cat-row__name">{t.name}</span>
                  </div>
                  <div className="cat-row__actions">
                    <button type="button" className="btn btn-edit" onClick={() => setBill({ open: true, mode: 'edit', template: t })}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={async () => {
                        const ok = await dialog.confirm({ title: '删除模板', message: `确定要删除“${t.name}”吗？`, okText: '删除', cancelText: '取消' })
                        if (!ok) return
                        await props.onDelete(t.id)
                        dialog.toast({ message: '已删除模板', kind: 'success' })
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

        {sorted.length > 0 && (
          <button type="button" className="fab" onClick={() => setBill({ open: true, mode: 'create', template: null })} aria-label="创建模板">
            +
          </button>
        )}

        <TemplateBillPage
          open={bill.open}
          mode={bill.open ? bill.mode : 'create'}
          template={bill.open && bill.mode === 'edit' ? bill.template : null}
          defaultType={props.defaultType}
          createDraft={props.createDraft}
          ledgerName={props.ledgerName}
          categories={props.categories}
          tags={props.tags}
          paymentMethods={props.paymentMethods}
          onClose={() => setBill({ open: false })}
          onCreate={async (name, draft) => {
            const created = await props.onCreate(name, draft)
            if (created) setBill({ open: false })
            return created
          }}
          onSave={async (templateId, patch) => {
            await props.onUpdate(templateId, patch)
            setBill({ open: false })
          }}
          onDelete={async (templateId) => {
            await props.onDelete(templateId)
            setBill({ open: false })
          }}
          onAddTag={props.onAddTag}
          onRenameTag={props.onRenameTag}
          onDeleteTag={props.onDeleteTag}
        />
      </div>
    </div>
  )
}

