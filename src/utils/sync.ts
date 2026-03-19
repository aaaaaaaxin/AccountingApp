import { storage } from './storage'
import { apiGet, apiPost } from './api'

type PulledOp = {
  version: number
  entity_type: string
  entity_id: string
  op_type: string
  payload: any
  received_at: string
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16)
}

function idempotencyForEntity(entityType: string, entity: any): string {
  const base = stableStringify(entity)
  return `${entityType}:${entity.id}:${fnv1a(base)}`
}

export async function syncNow(): Promise<{ pulled: number; pushed: number; version: number }> {
  let since = await storage.getSyncVersion()
  let pulled = 0

  while (true) {
    try {
      const res = await apiGet<{ ops: PulledOp[]; current_version: number }>(`/sync/pull?since_version=${since}&limit=500`)
      const ops = res.ops || []
      for (const op of ops) {
        await applyRemoteOp(op)
        since = op.version
        pulled += 1
      }
      await storage.setSyncVersion(Math.max(since, res.current_version || 0))
      if (ops.length < 500) break
    } catch (e: any) {
      if (e && typeof e === 'object' && e.status === 409 && e.detail && typeof e.detail === 'object' && (e.detail as any).code === 'baseline_required') {
        const bl = await apiGet<{ version: number; payload: any }>('/sync/baseline')
        await storage.applyBaselinePayload(bl.payload)
        since = bl.version
        await storage.setSyncVersion(bl.version)
        continue
      }
      throw e
    }
  }

  const pushed = await pushLocalSnapshot()
  const version = await storage.getSyncVersion()
  return { pulled, pushed, version }
}

async function applyRemoteOp(op: PulledOp): Promise<void> {
  if (op.op_type === 'upsert' || op.op_type === 'create' || op.op_type === 'update') {
    if (op.entity_type === 'ledger') return storage.upsertLedgerRemote(op.payload)
    if (op.entity_type === 'category') return storage.upsertCategoryRemote(op.payload)
    if (op.entity_type === 'template') return storage.upsertTemplateRemote(op.payload)
    if (op.entity_type === 'tag') return storage.upsertTagRemote(op.payload)
    if (op.entity_type === 'transaction') return storage.upsertTransactionRemote({ ...op.payload, deletedAt: null })
    return
  }

  if (op.entity_type === 'transaction' && op.op_type === 'delete') {
    const deletedAt = op.payload?.deleted_at || op.payload?.deletedAt || null
    const existing = await storage.getTransaction(op.entity_id)
    if (existing) {
      await storage.upsertTransactionRemote({ ...existing, deletedAt })
    }
    return
  }

  if (op.entity_type === 'transaction' && op.op_type === 'restore') {
    const snap = op.payload
    if (snap?.data?.id) {
      await storage.upsertTransactionRemote({ ...snap.data, deletedAt: snap.deleted_at ?? null })
    }
    return
  }

  if (op.entity_type === 'transaction' && op.op_type === 'purge_deleted') {
    await storage.purgeDeletedTransactionsLocal()
    return
  }

  if (op.entity_type === 'transaction' && op.op_type === 'purge_deleted_before') {
    const before = op.payload?.before
    if (typeof before === 'string') {
      await storage.purgeDeletedTransactionsBeforeLocal(before)
    }
  }
}

async function pushLocalSnapshot(): Promise<number> {
  const ledgers = await storage.getLedgers()
  let totalPushed = 0

  const chunks: any[] = []
  const purgeToken = await storage.getPendingPurgeToken()
  if (purgeToken) {
    chunks.push({
      entity_type: 'transaction',
      entity_id: '*',
      op_type: 'purge_deleted',
      payload: null,
      idempotency_key: `purge_deleted:${purgeToken}`,
    })
  }
  for (const ledger of ledgers) {
    chunks.push({ entity_type: 'ledger', entity_id: ledger.id, op_type: 'upsert', payload: ledger, idempotency_key: idempotencyForEntity('ledger', ledger) })

    const [categories, templates, tags, transactions] = await Promise.all([
      storage.getCategories(ledger.id),
      storage.getTemplates(ledger.id),
      storage.getTagEntities(ledger.id),
      storage.getAllTransactions(ledger.id),
    ])

    for (const c of categories) {
      chunks.push({ entity_type: 'category', entity_id: c.id, op_type: 'upsert', payload: c, idempotency_key: idempotencyForEntity('category', c) })
    }
    for (const t of templates) {
      chunks.push({ entity_type: 'template', entity_id: t.id, op_type: 'upsert', payload: t, idempotency_key: idempotencyForEntity('template', t) })
    }
    for (const tag of tags as any[]) {
      if (!tag?.id) continue
      chunks.push({ entity_type: 'tag', entity_id: tag.id, op_type: 'upsert', payload: tag, idempotency_key: idempotencyForEntity('tag', tag) })
    }
    for (const tx of transactions) {
      if (tx.deletedAt) {
        chunks.push({
          entity_type: 'transaction',
          entity_id: tx.id,
          op_type: 'delete',
          payload: null,
          idempotency_key: `transaction:${tx.id}:delete:${tx.deletedAt}`,
        })
      } else {
        chunks.push({ entity_type: 'transaction', entity_id: tx.id, op_type: 'upsert', payload: tx, idempotency_key: idempotencyForEntity('transaction', tx) })
      }
    }
  }

  for (let i = 0; i < chunks.length; i += 200) {
    const batch = chunks.slice(i, i + 200)
    const res = await apiPost<{ current_version: number; applied: number }>('/sync/push', { ops: batch })
    totalPushed += res.applied || 0
    if (typeof res.current_version === 'number') {
      await storage.setSyncVersion(Math.max(await storage.getSyncVersion(), res.current_version))
    }
    if (purgeToken && batch.some((x) => x.op_type === 'purge_deleted' && x.idempotency_key === `purge_deleted:${purgeToken}`)) {
      await storage.setPendingPurgeToken(null)
    }
  }

  return totalPushed
}
