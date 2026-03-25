import { openDB, DBSchema } from 'idb';
import { Ledger, Category, Transaction, Template, Tag } from '../types';

const DB_NAME = 'accounting_db';
const DB_VERSION = 1;
const MAX_LEDGERS = 10;
const MAX_TRANSACTIONS_PER_LEDGER = 10000;
const MAX_TOTAL_TRANSACTIONS = 100000;

interface AccountingDBSchema extends DBSchema {
  ledgers: {
    key: string;
    value: Ledger;
    indexes: { 'by-createdAt': string };
  };
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-ledgerId': string; 'by-parentId': string };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-ledgerId': string; 'by-date': string; 'by-ledgerId-date': [string, string] };
  };
  templates: {
    key: string;
    value: Template;
    indexes: { 'by-ledgerId': string };
  };
  tags: {
    key: string;
    value: Tag;
    indexes: { 'by-ledgerId': string };
  };
  metadata: {
    key: string;
    value: { key: string; value: any };
  };
}

const dbPromise = openDB<AccountingDBSchema>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('ledgers')) {
      const ledgerStore = db.createObjectStore('ledgers', { keyPath: 'id' });
      ledgerStore.createIndex('by-createdAt', 'createdAt');
    }
    if (!db.objectStoreNames.contains('categories')) {
      const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
      categoryStore.createIndex('by-ledgerId', 'ledgerId');
      categoryStore.createIndex('by-parentId', 'parentId');
    }
    if (!db.objectStoreNames.contains('transactions')) {
      const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionStore.createIndex('by-ledgerId', 'ledgerId');
      transactionStore.createIndex('by-date', 'date');
      transactionStore.createIndex('by-ledgerId-date', ['ledgerId', 'date']);
    }
    if (!db.objectStoreNames.contains('templates')) {
      const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
      templateStore.createIndex('by-ledgerId', 'ledgerId');
    }
    if (!db.objectStoreNames.contains('tags')) {
      const tagStore = db.createObjectStore('tags', { keyPath: 'id' });
      tagStore.createIndex('by-ledgerId', 'ledgerId');
    }
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }
  },
});

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const DEFAULT_LEDGER_NAME = '生活账本';

const DEFAULT_INCOME_CATEGORIES = [
  { name: '薪资', color: '#FFEAA7' },
  { name: '奖金', color: '#DDA0DD' },
  { name: '补助', color: '#98D8C8' },
  { name: '报销', color: '#74B9FF' },
  { name: '红包', color: '#FF7675' },
  { name: '理财', color: '#FDCB6E' },
  { name: '股票', color: '#A29BFE' },
  { name: '基金', color: '#81ECEC' },
  { name: '兼职', color: '#55EFC4' },
  { name: '礼物', color: '#FD79A8' },
  { name: '退款', color: '#00B894' },
  { name: '其他', color: '#636E72' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '餐饮', color: '#FF6B6B' },
  { name: '出行', color: '#4ECDC4' },
  { name: '购物', color: '#45B7D1' },
  { name: '日用', color: '#96CEB4' },
  { name: '娱乐', color: '#FFEAA7' },
  { name: '零食', color: '#DDA0DD' },
  { name: '水果', color: '#98D8C8' },
  { name: '烟酒', color: '#74B9FF' },
  { name: '水电', color: '#FF7675' },
  { name: '宠物', color: '#FDCB6E' },
  { name: '就医', color: '#A29BFE' },
  { name: '运动', color: '#81ECEC' },
  { name: '衣物', color: '#55EFC4' },
  { name: '教育', color: '#FD79A8' },
  { name: '美妆', color: '#00B894' },
  { name: '育婴', color: '#636E72' },
  { name: '通讯', color: '#E17055' },
  { name: '燃气', color: '#00CEC9' },
  { name: '手续费', color: '#6C5CE7' },
  { name: '其他', color: '#B2BEC3' },
];

let currentLedgerId: string | null = null;
let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await init();
    initialized = true;
  }
  if (!currentLedgerId) {
    currentLedgerId = await getCurrentLedgerId();
  }
}

async function init() {
  const db = await dbPromise;
  const ledgers = await db.getAll('ledgers');
  
  if (ledgers.length === 0) {
    await migrateFromLocalStorage();
  }
}

async function migrateFromLocalStorage() {
  try {
    const oldTransactions = localStorage.getItem('accounting_transactions');
    const oldCategories = localStorage.getItem('accounting_categories');
    
    if (oldCategories || oldTransactions) {
      const ledger = await createLedger(DEFAULT_LEDGER_NAME);
      
      if (oldCategories) {
        const categories = JSON.parse(oldCategories);
        for (const cat of categories) {
          await addCategoryInternal({
            ...cat,
            parentId: null,
            ledgerId: ledger.id,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        await createDefaultCategories(ledger.id);
      }
      
      if (oldTransactions) {
        const transactions = JSON.parse(oldTransactions);
        for (const tx of transactions) {
          await addTransactionInternal({
            type: tx.type,
            amount: tx.amount,
            categoryId: tx.categoryId,
            date: tx.date,
            note: tx.note,
            ledgerId: ledger.id,
          });
        }
      }
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
}

async function createDefaultLedger() {
  const ledger = await createLedger(DEFAULT_LEDGER_NAME);
  await createDefaultCategories(ledger.id);
  return ledger;
}

async function ensureDefaultLedger(): Promise<Ledger> {
  const ledgers = await getLedgers()
  if (ledgers.length > 0) return ledgers[0]
  const ledger = await createDefaultLedger()
  await setCurrentLedgerId(ledger.id)
  return ledger
}

async function createDefaultCategories(ledgerId: string) {
  for (const [i, cat] of DEFAULT_INCOME_CATEGORIES.entries()) {
    await addCategoryInternal({
      name: cat.name,
      type: 'income',
      color: cat.color,
      order: i,
      parentId: null,
      ledgerId,
    });
  }
  for (const [i, cat] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    await addCategoryInternal({
      name: cat.name,
      type: 'expense',
      color: cat.color,
      order: i,
      parentId: null,
      ledgerId,
    });
  }
}

async function getMetadata(key: string) {
  const db = await dbPromise;
  const item = await db.get('metadata', key);
  return item?.value;
}

async function setMetadata(key: string, value: any) {
  const db = await dbPromise;
  await db.put('metadata', { key, value });
}

async function getSyncVersion(): Promise<number> {
  const v = await getMetadata('syncVersion')
  return typeof v === 'number' ? v : 0
}

async function setSyncVersion(v: number): Promise<void> {
  await setMetadata('syncVersion', v)
}

async function getPendingPurgeToken(): Promise<string | null> {
  const v = await getMetadata('pendingPurgeToken')
  return typeof v === 'string' ? v : null
}

async function setPendingPurgeToken(token: string | null): Promise<void> {
  await setMetadata('pendingPurgeToken', token)
}

async function getPendingLedgerDeletes(): Promise<{ id: string; deletedAt: string }[]> {
  const v = await getMetadata('pendingLedgerDeletes')
  if (!Array.isArray(v)) return []
  const out: { id: string; deletedAt: string }[] = []
  for (const it of v) {
    if (!it || typeof it !== 'object') continue
    const id = (it as any).id
    const deletedAt = (it as any).deletedAt
    if (typeof id === 'string' && typeof deletedAt === 'string') out.push({ id, deletedAt })
  }
  return out
}

async function setPendingLedgerDeletes(items: { id: string; deletedAt: string }[]): Promise<void> {
  await setMetadata('pendingLedgerDeletes', items)
}

async function upsertLedgerRemote(ledger: Ledger): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  await db.put('ledgers', ledger)
}

async function upsertCategoryRemote(category: Category): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  await db.put('categories', category)
}

async function upsertTemplateRemote(template: Template): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  await db.put('templates', template)
}

async function upsertTagRemote(tag: Tag): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  await db.put('tags', tag)
}

async function upsertTransactionRemote(transaction: Transaction): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  await db.put('transactions', transaction)
}

async function deleteTransactionRemote(id: string): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  await db.delete('transactions', id)
}

async function deleteLedgerRemote(ledgerId: string): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  const tx = db.transaction(['ledgers', 'categories', 'transactions', 'templates', 'tags'], 'readwrite')

  await tx.objectStore('ledgers').delete(ledgerId)

  const categories = await tx.objectStore('categories').index('by-ledgerId').getAll(ledgerId)
  for (const c of categories) await tx.objectStore('categories').delete(c.id)

  const templates = await tx.objectStore('templates').index('by-ledgerId').getAll(ledgerId)
  for (const t of templates) await tx.objectStore('templates').delete(t.id)

  const tags = await tx.objectStore('tags').index('by-ledgerId').getAll(ledgerId)
  for (const t of tags) await tx.objectStore('tags').delete(t.id)

  const transactions = await tx.objectStore('transactions').index('by-ledgerId').getAll(ledgerId)
  for (const t of transactions) await tx.objectStore('transactions').delete(t.id)

  await tx.done
}

async function applyBaselinePayload(payload: any): Promise<void> {
  await ensureInit()
  const db = await dbPromise
  const tx = db.transaction(['ledgers', 'categories', 'templates', 'tags', 'transactions'], 'readwrite')
  await Promise.all([
    tx.objectStore('transactions').clear(),
    tx.objectStore('categories').clear(),
    tx.objectStore('templates').clear(),
    tx.objectStore('tags').clear(),
    tx.objectStore('ledgers').clear(),
  ])

  if (payload?.ledger) {
    for (const it of payload.ledger) {
      if (it?.data?.id) await tx.objectStore('ledgers').put(it.data)
    }
  }
  if (payload?.category) {
    for (const it of payload.category) {
      if (it?.data?.id) await tx.objectStore('categories').put(it.data)
    }
  }
  if (payload?.template) {
    for (const it of payload.template) {
      if (it?.data?.id) await tx.objectStore('templates').put(it.data)
    }
  }
  if (payload?.tag) {
    for (const it of payload.tag) {
      if (it?.data?.id) await tx.objectStore('tags').put(it.data)
    }
  }
  if (payload?.transactions) {
    for (const it of payload.transactions) {
      const data = it?.data
      if (data?.id) {
        await tx.objectStore('transactions').put({ ...data, deletedAt: it.deleted_at ?? null })
      }
    }
  }

  await tx.done
  const firstLedgerId = payload?.ledger?.[0]?.data?.id
  if (firstLedgerId) {
    await setCurrentLedgerId(firstLedgerId)
  }
}

async function getCurrentLedgerId() {
  const id = await getMetadata('currentLedgerId');
  if (id) {
    const ledger = await getLedger(id);
    if (ledger) return id;
  }
  const ledgers = await getLedgers();
  if (ledgers.length > 0) {
    await setCurrentLedgerId(ledgers[0].id);
    return ledgers[0].id;
  }
  return null;
}

async function setCurrentLedgerId(id: string) {
  currentLedgerId = id;
  await setMetadata('currentLedgerId', id);
}

async function getLedgers(): Promise<Ledger[]> {
  const db = await dbPromise;
  return db.getAllFromIndex('ledgers', 'by-createdAt');
}

async function getLedger(id: string): Promise<Ledger | undefined> {
  const db = await dbPromise;
  return db.get('ledgers', id);
}

function normalizeLedgerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

async function createLedger(name: string): Promise<Ledger> {
  const db = await dbPromise;
  const ledgers = await db.getAll('ledgers');
  const nextName = name.trim()
  if (!nextName) {
    throw new Error('账本名称不能为空')
  }
  const nextNorm = normalizeLedgerName(nextName)
  if (ledgers.some((l) => normalizeLedgerName(l.name) === nextNorm)) {
    throw new Error('账本名称已存在')
  }
  
  if (ledgers.length >= MAX_LEDGERS) {
    throw new Error(`最多只能创建 ${MAX_LEDGERS} 个账本`);
  }
  
  const now = new Date().toISOString();
  const ledger: Ledger = {
    id: generateId(),
    name: nextName,
    createdAt: now,
    updatedAt: now,
  };
  await db.add('ledgers', ledger);
  return ledger;
}

async function updateLedger(id: string, updates: Partial<Ledger>): Promise<Ledger | null> {
  const db = await dbPromise;
  const ledger = await db.get('ledgers', id);
  if (!ledger) return null;
  if (typeof updates.name === 'string') {
    const nextName = updates.name.trim()
    if (!nextName) {
      throw new Error('账本名称不能为空')
    }
    const all = await db.getAll('ledgers')
    const nextNorm = normalizeLedgerName(nextName)
    if (all.some((l) => l.id !== id && normalizeLedgerName(l.name) === nextNorm)) {
      throw new Error('账本名称已存在')
    }
    updates = { ...updates, name: nextName }
  }
  const updated = { ...ledger, ...updates, updatedAt: new Date().toISOString() };
  await db.put('ledgers', updated);
  return updated;
}

async function deleteLedger(id: string): Promise<boolean> {
  const db = await dbPromise;
  const tombstones = await getPendingLedgerDeletes()
  if (!tombstones.some((x) => x.id === id)) {
    tombstones.push({ id, deletedAt: new Date().toISOString() })
    await setPendingLedgerDeletes(tombstones)
  }
  const tx = db.transaction(['ledgers', 'categories', 'transactions', 'templates', 'tags'], 'readwrite');
  
  const ledgerStore = tx.objectStore('ledgers');
  await ledgerStore.delete(id);
  
  const categories = await tx.objectStore('categories').index('by-ledgerId').getAll(id);
  for (const cat of categories) {
    await tx.objectStore('categories').delete(cat.id);
  }
  
  const transactions = await tx.objectStore('transactions').index('by-ledgerId').getAll(id);
  for (const t of transactions) {
    await tx.objectStore('transactions').delete(t.id);
  }
  
  const templates = await tx.objectStore('templates').index('by-ledgerId').getAll(id);
  for (const t of templates) {
    await tx.objectStore('templates').delete(t.id);
  }
  
  const tags = await tx.objectStore('tags').index('by-ledgerId').getAll(id);
  for (const t of tags) {
    await tx.objectStore('tags').delete(t.id);
  }
  
  await tx.done;
  return true;
}

async function getCategoriesInternal(ledgerId: string): Promise<Category[]> {
  const db = await dbPromise;
  return db.getAllFromIndex('categories', 'by-ledgerId', ledgerId);
}

async function addCategoryInternal(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  const db = await dbPromise;
  const newCategory: Category = {
    ...category,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await db.add('categories', newCategory);
  return newCategory;
}

async function updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
  const db = await dbPromise;
  const category = await db.get('categories', id);
  if (!category) return null;
  const updated = { ...category, ...updates };
  await db.put('categories', updated);
  return updated;
}

async function deleteCategoryInternal(id: string, migrateToOther: boolean = false): Promise<boolean> {
  const db = await dbPromise;
  const category = await db.get('categories', id);
  if (!category) return false;

  const tx = db.transaction(['categories', 'transactions'], 'readwrite');
  
  if (migrateToOther) {
    const categories = await tx.objectStore('categories').index('by-ledgerId').getAll(category.ledgerId);
    const otherCategory = categories.find(c => c.name === '其他' && c.type === category.type && c.parentId === null);
    
    if (otherCategory) {
      const transactions = await tx.objectStore('transactions').getAll();
      for (const t of transactions) {
        if (t.categoryId === id) {
          await tx.objectStore('transactions').put({ ...t, categoryId: otherCategory.id });
        }
      }
    }
  } else {
    const transactions = await tx.objectStore('transactions').getAll();
    for (const t of transactions) {
      if (t.categoryId === id) {
        await tx.objectStore('transactions').delete(t.id);
      }
    }
  }
  
  await tx.objectStore('categories').delete(id);
  await tx.done;
  return true;
}

async function getTransactionsInternal(ledgerId: string, limit?: number, offset?: number): Promise<Transaction[]> {
  const db = await dbPromise;
  const index = db.transaction('transactions').store.index('by-ledgerId-date');
  const all = await index.getAll(IDBKeyRange.bound([ledgerId, ''], [ledgerId, '\uffff']));
  const visible = all.filter((t) => !t.deletedAt);
  visible.reverse();
  
  if (offset !== undefined && limit !== undefined) {
    return visible.slice(offset, offset + limit);
  }
  return visible;
}

async function getAllTransactionsInternal(ledgerId: string): Promise<Transaction[]> {
  const db = await dbPromise;
  const index = db.transaction('transactions').store.index('by-ledgerId-date');
  const all = await index.getAll(IDBKeyRange.bound([ledgerId, ''], [ledgerId, '\uffff']));
  all.reverse();
  return all;
}

async function purgeDeletedTransactionsLocal(): Promise<number> {
  await ensureInit()
  const db = await dbPromise
  const all = await db.getAll('transactions')
  const deleted = all.filter((t) => t.deletedAt)
  for (const t of deleted) {
    await db.delete('transactions', t.id)
  }
  return deleted.length
}

async function purgeDeletedTransactionsBeforeLocal(beforeIso: string): Promise<number> {
  await ensureInit()
  const beforeMs = Date.parse(beforeIso)
  if (!Number.isFinite(beforeMs)) return 0
  const db = await dbPromise
  const all = await db.getAll('transactions')
  let purged = 0
  for (const t of all) {
    if (!t.deletedAt) continue
    const d = Date.parse(t.deletedAt)
    if (!Number.isFinite(d)) continue
    if (d < beforeMs) {
      await db.delete('transactions', t.id)
      purged += 1
    }
  }
  return purged
}

async function searchTransactions(ledgerId: string, query: string): Promise<Transaction[]> {
  const db = await dbPromise;
  const transactions = await db.getAllFromIndex('transactions', 'by-ledgerId', ledgerId);
  const lowerQuery = query.toLowerCase();
  return transactions
    .filter((t) => !t.deletedAt)
    .filter((t) => t.note.toLowerCase().includes(lowerQuery))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function getTransaction(id: string): Promise<Transaction | undefined> {
  const db = await dbPromise;
  return db.get('transactions', id);
}

async function addTransactionInternal(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
  const db = await dbPromise;

  const total = await db.count('transactions')
  if (total >= MAX_TOTAL_TRANSACTIONS) {
    throw new Error(`总记录数已达上限（${MAX_TOTAL_TRANSACTIONS}）`)
  }
  
  const txs = await db.getAllFromIndex('transactions', 'by-ledgerId', transaction.ledgerId);
  if (txs.length >= MAX_TRANSACTIONS_PER_LEDGER) {
    throw new Error(`单个账本最多只能创建 ${MAX_TRANSACTIONS_PER_LEDGER} 条记录`);
  }
  
  const now = new Date().toISOString();
  const newTransaction: Transaction = {
    ...transaction,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.add('transactions', newTransaction);
  return newTransaction;
}

async function updateTransactionInternal(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
  const db = await dbPromise;
  const transaction = await db.get('transactions', id);
  if (!transaction) return null;
  const updated = { ...transaction, ...updates, updatedAt: new Date().toISOString() };
  await db.put('transactions', updated);
  return updated;
}

async function deleteTransactionInternal(id: string): Promise<boolean> {
  const db = await dbPromise;
  const transaction = await db.get('transactions', id);
  if (!transaction) return false;
  if (transaction.deletedAt) return true;
  const now = new Date().toISOString();
  await db.put('transactions', { ...transaction, deletedAt: now, updatedAt: now });
  return true;
}

async function restoreTransactionLocal(id: string): Promise<boolean> {
  const db = await dbPromise
  const transaction = await db.get('transactions', id)
  if (!transaction) return false
  if (!transaction.deletedAt) return true
  const now = new Date().toISOString()
  await db.put('transactions', { ...transaction, deletedAt: null, updatedAt: now })
  return true
}

async function getDeletedTransactions(ledgerId: string, limit: number = 100, offset: number = 0): Promise<Transaction[]> {
  const all = await getAllTransactionsInternal(ledgerId)
  const deleted = all.filter((t) => !!t.deletedAt)
  return deleted.slice(offset, offset + limit)
}

async function getTotalTransactionCount(): Promise<number> {
  const db = await dbPromise
  return db.count('transactions')
}

async function getMonthlyStats(ledgerId: string, year: number, month: number): Promise<{ income: number; expense: number; balance: number }> {
  const db = await dbPromise;
  const transactions = await db.getAllFromIndex('transactions', 'by-ledgerId', ledgerId);
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  
  let income = 0;
  let expense = 0;
  
  for (const t of transactions) {
    if (t.deletedAt) continue;
    if (t.date.startsWith(monthStr)) {
      if (t.type === 'income') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    }
  }
  
  return { income, expense, balance: income - expense };
}

async function getTemplates(ledgerId: string): Promise<Template[]> {
  const db = await dbPromise;
  return db.getAllFromIndex('templates', 'by-ledgerId', ledgerId);
}

async function addTemplate(template: Omit<Template, 'id' | 'createdAt'>): Promise<Template> {
  const db = await dbPromise;
  const newTemplate: Template = {
    ...template,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await db.add('templates', newTemplate);
  return newTemplate;
}

async function deleteTemplate(id: string): Promise<boolean> {
  const db = await dbPromise;
  await db.delete('templates', id);
  return true;
}

async function updateTemplate(id: string, patch: Partial<Omit<Template, 'id' | 'ledgerId' | 'createdAt'>>): Promise<boolean> {
  const db = await dbPromise;
  const existing = await db.get('templates', id);
  if (!existing) return false;
  const next: Template = {
    ...existing,
    ...patch,
  };
  await db.put('templates', next);
  return true;
}

async function getTags(ledgerId: string): Promise<string[]> {
  const db = await dbPromise;
  const tags = await db.getAllFromIndex('tags', 'by-ledgerId', ledgerId);
  return tags.map(t => t.name);
}

async function getTagEntities(ledgerId: string): Promise<Tag[]> {
  const db = await dbPromise;
  return db.getAllFromIndex('tags', 'by-ledgerId', ledgerId);
}

async function addTag(ledgerId: string, tagName: string): Promise<Tag> {
  const db = await dbPromise;
  const newTag: Tag = {
    id: generateId(),
    name: tagName,
    color: '#3498db',
    ledgerId,
    createdAt: new Date().toISOString(),
  };
  await db.add('tags', newTag);
  return newTag;
}

async function deleteTag(ledgerId: string, tagName: string): Promise<boolean> {
  const db = await dbPromise;
  const tags = await db.getAllFromIndex('tags', 'by-ledgerId', ledgerId);
  const tagToDelete = tags.find(t => t.name === tagName);
  if (tagToDelete) {
    await db.delete('tags', tagToDelete.id);
  }
  return true;
}

async function renameTag(ledgerId: string, oldName: string, newName: string): Promise<boolean> {
  const db = await dbPromise;
  const tx = db.transaction(['tags', 'transactions'], 'readwrite');
  const tagStore = tx.objectStore('tags');
  const txStore = tx.objectStore('transactions');

  const tags = await tagStore.index('by-ledgerId').getAll(ledgerId);
  const target = tags.find((t) => t.name === oldName);
  if (!target) {
    await tx.done;
    return false;
  }

  await tagStore.put({ ...target, name: newName });

  const transactions = await txStore.index('by-ledgerId').getAll(ledgerId);
  for (const tr of transactions) {
    const arr = tr.tags || [];
    if (!arr.includes(oldName)) continue;
    const next = arr.map((x) => (x === oldName ? newName : x));
    await txStore.put({ ...tr, tags: Array.from(new Set(next)) });
  }

  await tx.done;
  return true;
}

async function deleteTagAndCleanup(ledgerId: string, tagName: string): Promise<boolean> {
  const db = await dbPromise;
  const tx = db.transaction(['tags', 'transactions'], 'readwrite');
  const tagStore = tx.objectStore('tags');
  const txStore = tx.objectStore('transactions');

  const tags = await tagStore.index('by-ledgerId').getAll(ledgerId);
  for (const t of tags) {
    if (t.name === tagName) {
      await tagStore.delete(t.id);
    }
  }

  const transactions = await txStore.index('by-ledgerId').getAll(ledgerId);
  for (const tr of transactions) {
    const arr = tr.tags || [];
    if (!arr.includes(tagName)) continue;
    const next = arr.filter((x) => x !== tagName);
    await txStore.put({ ...tr, tags: next });
  }

  await tx.done;
  return true;
}

const compatibilityStorage = {
  getTransactions() {
    let result: Transaction[] = [];
    (async () => {
      await ensureInit();
      if (currentLedgerId) {
        result = await getTransactionsInternal(currentLedgerId);
      }
    })();
    return result;
  },

  saveTransactions() {
  },

  addTransaction(transaction: any) {
    (async () => {
      await ensureInit();
      if (currentLedgerId) {
        await addTransactionInternal({
          ...transaction,
          ledgerId: currentLedgerId,
        });
      }
    })();
  },

  updateTransaction(id: string, updates: any) {
    (async () => {
      await ensureInit();
      await updateTransactionInternal(id, updates);
    })();
  },

  deleteTransaction(id: string) {
    (async () => {
      await ensureInit();
      await deleteTransactionInternal(id);
    })();
    return true;
  },

  getCategories() {
    let result: Category[] = [];
    (async () => {
      await ensureInit();
      if (currentLedgerId) {
        result = await getCategoriesInternal(currentLedgerId);
      }
    })();
    return result;
  },

  saveCategories() {
  },

  addCategory(category: any) {
    (async () => {
      await ensureInit();
      if (currentLedgerId) {
        await addCategoryInternal({
          ...category,
          parentId: null,
          ledgerId: currentLedgerId,
        });
      }
    })();
  },

  deleteCategory(id: string) {
    (async () => {
      await ensureInit();
      await deleteCategoryInternal(id, false);
    })();
    return true;
  },
};

export const storage = {
  ...compatibilityStorage,
  init,
  getLedgers,
  getLedger,
  createLedger,
  updateLedger,
  deleteLedger,
  ensureDefaultLedger,
  getCurrentLedgerId,
  setCurrentLedgerId,
  createDefaultCategories,
  getCategories: getCategoriesInternal,
  addCategory: addCategoryInternal,
  updateCategory,
  deleteCategory: deleteCategoryInternal,
  getTransactions: getTransactionsInternal,
  getAllTransactions: getAllTransactionsInternal,
  searchTransactions,
  getTransaction,
  addTransaction: addTransactionInternal,
  updateTransaction: updateTransactionInternal,
  deleteTransaction: deleteTransactionInternal,
  restoreTransactionLocal,
  getDeletedTransactions,
  getTotalTransactionCount,
  getMonthlyStats,
  getTemplates,
  addTemplate,
  deleteTemplate,
  updateTemplate,
  getTags,
  getTagEntities,
  addTag,
  deleteTag,
  renameTag,
  deleteTagAndCleanup,
  purgeDeletedTransactionsLocal,
  purgeDeletedTransactionsBeforeLocal,
  getPendingPurgeToken,
  setPendingPurgeToken,
  getPendingLedgerDeletes,
  setPendingLedgerDeletes,
  getSyncVersion,
  setSyncVersion,
  upsertLedgerRemote,
  upsertCategoryRemote,
  upsertTemplateRemote,
  upsertTagRemote,
  upsertTransactionRemote,
  deleteTransactionRemote,
  deleteLedgerRemote,
  applyBaselinePayload,
};
