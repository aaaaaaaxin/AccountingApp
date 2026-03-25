import { useEffect, useMemo, useRef, useState } from 'react'
import { Transaction, Category, Ledger, Template } from './types'
import { storage } from './utils/storage'
import { BottomNav, BottomNavKey } from './components/common/BottomNav'
import { HomePage } from './components/pages/HomePage'
import { AddPage } from './components/pages/AddPage'
import { StatsPage } from './components/pages/StatsPage'
import { AccountsPage } from './components/pages/AccountsPage'
import { SettingsPage } from './components/pages/SettingsPage'
import { TransactionDetailSheet } from './components/common/TransactionDetailSheet'
import { useAppDialog } from './components/common/AppDialogProvider'
import { ReportPage } from './components/pages/ReportPage'
import { CategoryListPage } from './components/pages/CategoryListPage'
import { CategoryDetailPage } from './components/pages/CategoryDetailPage'
import { CategoryEditPage } from './components/pages/CategoryEditPage'
import { AuthPage } from './components/pages/AuthPage'
import { apiGet, apiPost } from './utils/api'
import { syncNow as runSync } from './utils/sync'
import { createSyncScheduler } from './utils/syncScheduler'

function App() {
  const dialog = useAppDialog()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<string[]>([])
  const [accountsTransactions, setAccountsTransactions] = useState<Transaction[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [lastTransactionData, setLastTransactionData] = useState<{
    type: 'income' | 'expense'
    categoryId: string
    paymentMethod: string
    tags: string[]
  } | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentLedgerId, setCurrentLedgerId] = useState<string | null>(null)
  const [showNewLedgerModal, setShowNewLedgerModal] = useState(false)
  const [newLedgerName, setNewLedgerName] = useState('')
  const [monthlyStats, setMonthlyStats] = useState({ income: 0, expense: 0, balance: 0 })
  const [visibleTransactions, setVisibleTransactions] = useState<number>(10)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeTab, setActiveTab] = useState<BottomNavKey>('home')
  const [addOpen, setAddOpen] = useState(false)
  const [addReturnTab, setAddReturnTab] = useState<BottomNavKey>('home')
  const [addView, setAddView] = useState<'add' | 'categoryList' | 'categoryDetail' | 'categoryEdit'>('add')
  const [categoryMgmtType, setCategoryMgmtType] = useState<'income' | 'expense'>('expense')
  const [categoryDetailId, setCategoryDetailId] = useState<string | null>(null)
  const [categoryEditState, setCategoryEditState] = useState<
    | { mode: 'createMain' | 'createChild' | 'editMain' | 'editChild'; categoryId?: string; parentId?: string | null; returnTo: 'add' | 'categoryList' | 'categoryDetail' }
    | null
  >(null)
  const [showLedgerSheet, setShowLedgerSheet] = useState<boolean>(false)
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null)
  const ITEMS_PER_PAGE = 10

  const [authChecked, setAuthChecked] = useState(false)
  const [authUsername, setAuthUsername] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<{ status: 'idle' | 'syncing' | 'ok' | 'error'; message?: string; lastSyncAt?: string; lastResult?: { pulled: number; pushed: number; version: number } }>({
    status: 'idle',
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const currentLedgerIdRef = useRef<string | null>(null)
  const selectedLedgerIdsRef = useRef<string[]>([])
  const syncSchedulerRef = useRef<ReturnType<typeof createSyncScheduler> | null>(null)
  const scaleWarnLevelRef = useRef<0 | 1 | 2>(0)
  
  const PAYMENT_METHODS = [
    { id: 'cash', name: '💵 现金' },
    { id: 'wechat', name: '💬 微信' },
    { id: 'alipay', name: '🐜 支付宝' },
    { id: 'card', name: '💳 银行卡' },
    { id: 'credit', name: '💳 信用卡' },
  ]

  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    paymentMethod: 'cash' as string,
    tags: [] as string[],
  })

  const computeMonthlyStatsFromTransactions = (txs: Transaction[], year: number, month: number) => {
    const ym = `${year}-${String(month).padStart(2, '0')}`
    let income = 0
    let expense = 0
    for (const t of txs) {
      if (!t.date.startsWith(ym)) continue
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense, balance: income - expense }
  }

  const sortTransactionsNewestFirst = (txs: Transaction[]) => {
    txs.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }

  const refreshCurrentLedgerTransactions = async (ledgerId: string) => {
    const txs = await storage.getTransactions(ledgerId)
    sortTransactionsNewestFirst(txs)
    setTransactions(txs)
    const now = new Date()
    setMonthlyStats(computeMonthlyStatsFromTransactions(txs, now.getFullYear(), now.getMonth() + 1))
    setVisibleTransactions(ITEMS_PER_PAGE)
  }

  const refreshAccountsTransactions = async (ledgerIds: string[]) => {
    if (ledgerIds.length === 0) return
    const groups = await Promise.all(ledgerIds.map((id) => storage.getTransactions(id)))
    const txs = groups.flat()
    sortTransactionsNewestFirst(txs)
    setAccountsTransactions(txs)
  }

  useEffect(() => {
    currentLedgerIdRef.current = currentLedgerId
  }, [currentLedgerId])

  useEffect(() => {
    selectedLedgerIdsRef.current = selectedLedgerIds
  }, [selectedLedgerIds])

  const refreshAfterSync = async () => {
    let allLedgers = await storage.getLedgers()
    if (allLedgers.length === 0) {
      const created = await storage.ensureDefaultLedger()
      allLedgers = await storage.getLedgers()
      setLedgers(allLedgers)
      setCurrentLedgerId(created.id)
      setSelectedLedgerIds([created.id])
      const [cats, allTags, allTemplates] = await Promise.all([
        storage.getCategories(created.id),
        storage.getTags(created.id),
        storage.getTemplates(created.id),
      ])
      setCategories(cats)
      setTags(allTags)
      setTemplates(allTemplates)
      await refreshCurrentLedgerTransactions(created.id)
      await refreshAccountsTransactions([created.id])
      await checkScaleHint()
      requestSync({ force: true })
      return
    }
    setLedgers(allLedgers)

    let ledgerId = currentLedgerIdRef.current
    if (!ledgerId) {
      ledgerId = await storage.getCurrentLedgerId()
      setCurrentLedgerId(ledgerId)
    }
    if (!ledgerId) return

    const [cats, allTags, allTemplates] = await Promise.all([
      storage.getCategories(ledgerId),
      storage.getTags(ledgerId),
      storage.getTemplates(ledgerId),
    ])
    setCategories(cats)
    setTags(allTags)
    setTemplates(allTemplates)

    await refreshCurrentLedgerTransactions(ledgerId)
    const ids = selectedLedgerIdsRef.current.length ? selectedLedgerIdsRef.current : [ledgerId]
    setSelectedLedgerIds(ids)
    await refreshAccountsTransactions(ids)
    await checkScaleHint()
  }

  const checkScaleHint = async () => {
    try {
      const total = await storage.getTotalTransactionCount()
      const level: 0 | 1 | 2 = total >= 95_000 ? 2 : total >= 80_000 ? 1 : 0
      if (level === 0) return
      if (level <= scaleWarnLevelRef.current) return
      scaleWarnLevelRef.current = level
      dialog.toast({ message: `记录数已达 ${total}，建议定期清理回收站并保持同步`, kind: 'info', durationMs: 2600 })
    } catch {
    }
  }

  const requestSync = (opts?: { force?: boolean }) => {
    if (!authUsername) return
    if (!syncSchedulerRef.current) return
    syncSchedulerRef.current.trigger(opts)
  }

  const loadData = async () => {
    try {
      await storage.init()
      const ledgerId = await storage.getCurrentLedgerId()
      if (ledgerId) {
        setCurrentLedgerId(ledgerId)
        const cats = await storage.getCategories(ledgerId)
        const allLedgers = await storage.getLedgers()
        const allTags = await storage.getTags(ledgerId)
        const allTemplates = await storage.getTemplates(ledgerId)
        setCategories(cats)
        setLedgers(allLedgers)
        setTags(allTags)
        setTemplates(allTemplates)
        await refreshCurrentLedgerTransactions(ledgerId)
        setSelectedLedgerIds([ledgerId])
        await refreshAccountsTransactions([ledgerId])
        await checkScaleHint()
      }
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }

  const switchLedger = async (ledgerId: string) => {
    await storage.setCurrentLedgerId(ledgerId)
    setCurrentLedgerId(ledgerId)
    const cats = await storage.getCategories(ledgerId)
    const allTags = await storage.getTags(ledgerId)
    const allTemplates = await storage.getTemplates(ledgerId)
    setCategories(cats)
    setTags(allTags)
    setTemplates(allTemplates)
    const nextSelected = selectedLedgerIds.includes(ledgerId) ? selectedLedgerIds : [ledgerId, ...selectedLedgerIds]
    setSelectedLedgerIds(nextSelected)
    await refreshCurrentLedgerTransactions(ledgerId)
    await refreshAccountsTransactions(nextSelected.length ? nextSelected : [ledgerId])
  }

  const toggleLedgerSelection = async (ledgerId: string) => {
    const exists = selectedLedgerIds.includes(ledgerId)
    const next = exists ? selectedLedgerIds.filter((x) => x !== ledgerId) : [...selectedLedgerIds, ledgerId]
    const finalNext = next.length ? next : [ledgerId]
    setSelectedLedgerIds(finalNext)
    await refreshAccountsTransactions(finalNext)
  }

  const loadMoreTransactions = () => {
    setVisibleTransactions(prev => prev + ITEMS_PER_PAGE)
  }

  const createLedger = async () => {
    if (!newLedgerName.trim()) return
    try {
      const newLedger = await storage.createLedger(newLedgerName.trim())
      await storage.createDefaultCategories(newLedger.id)
      const allLedgers = await storage.getLedgers()
      setLedgers(allLedgers)
      await switchLedger(newLedger.id)
      setNewLedgerName('')
      setShowNewLedgerModal(false)
      requestSync()
    } catch (error) {
      await dialog.alert({ title: '创建账本失败', message: error instanceof Error ? error.message : '创建账本失败' })
    }
  }

  const deleteLedger = async (ledgerId: string) => {
    if (ledgers.length <= 1) {
      await dialog.alert({ title: '提示', message: '至少需要保留一个账本！' })
      return
    }
    const ok = await dialog.confirm({
      title: '删除账本',
      message: '确定要删除这个账本吗？账本内的所有记录和分类都会被删除！',
      okText: '删除',
      cancelText: '取消',
    })
    if (!ok) {
      return
    }
    await storage.deleteLedger(ledgerId)
    const allLedgers = await storage.getLedgers()
    setLedgers(allLedgers)
    const nextSelected = selectedLedgerIds.filter((id) => id !== ledgerId)

    if (allLedgers.length === 0) {
      setSelectedLedgerIds([])
      setAccountsTransactions([])
      setCurrentLedgerId(null)
      setCategories([])
      setTags([])
      setTemplates([])
      setTransactions([])
      setMonthlyStats({ income: 0, expense: 0, balance: 0 })
      requestSync()
      return
    }

    const fallbackLedgerId = allLedgers[0].id
    const finalSelected = nextSelected.length ? nextSelected : [fallbackLedgerId]
    setSelectedLedgerIds(finalSelected)
    await refreshAccountsTransactions(finalSelected)

    if (currentLedgerId === ledgerId) {
      await switchLedger(fallbackLedgerId)
    }
    requestSync()
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await apiGet<{ username: string }>('/auth/me')
        if (cancelled) return
        setAuthUsername(me.username)
        setAuthError(null)
      } catch (e) {
        if (cancelled) return
        setAuthUsername(null)
        setAuthError(e instanceof Error ? e.message : '未登录')
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authUsername) {
      syncSchedulerRef.current?.stop()
      syncSchedulerRef.current = null
      setSyncStatus({ status: 'idle' })
      return
    }
    if (!syncSchedulerRef.current) {
      syncSchedulerRef.current = createSyncScheduler({
        run: runSync,
        onStatus: setSyncStatus,
        onSuccess: async () => {
          await refreshAfterSync()
        },
        maxBackoffMs: 5 * 60 * 1000,
      })
    }
    requestSync({ force: false })
  }, [authUsername])

  useEffect(() => {
    if (!authUsername) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') requestSync()
    }
    const onOnline = () => requestSync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [authUsername])

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'amount') {
      let newValue = value
      
      newValue = newValue.replace(/[^0-9.+-]/g, '')

      const sanitize = (raw: string) => {
        let out = ''
        let segmentHasDot = false
        let segmentDecimals = 0
        let last: string | null = null

        for (const ch of raw) {
          if (ch === '+' || ch === '-') {
            if (out.length === 0) continue
            if (last === '+' || last === '-') {
              out = out.slice(0, -1) + ch
              last = ch
              segmentHasDot = false
              segmentDecimals = 0
              continue
            }
            if (last === '.') continue
            out += ch
            last = ch
            segmentHasDot = false
            segmentDecimals = 0
            continue
          }
          if (ch === '.') {
            if (segmentHasDot) continue
            if (out.length === 0 || last === '+' || last === '-') {
              out += '0.'
            } else {
              out += '.'
            }
            segmentHasDot = true
            last = '.'
            continue
          }
          if (ch >= '0' && ch <= '9') {
            if (segmentHasDot) {
              if (segmentDecimals >= 2) continue
              segmentDecimals += 1
            }
            out += ch
            last = ch
          }
          if (out.length >= 20) break
        }
        return out
      }

      newValue = sanitize(newValue)
      
      setFormData(prev => ({ ...prev, [name]: newValue }))
    } else if (name === 'note') {
      setFormData(prev => ({ ...prev, [name]: value.substring(0, 200) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const applyLastTransactionData = () => {
    if (!lastTransactionData) return
    setFormData({
      type: lastTransactionData.type,
      amount: '',
      categoryId: lastTransactionData.categoryId,
      date: new Date().toISOString().split('T')[0],
      note: '',
      paymentMethod: lastTransactionData.paymentMethod,
      tags: lastTransactionData.tags,
    })
  }

  const evaluateAmountExpression = (input: string) => {
    const s = input.replace(/\s+/g, '')
    if (!s) return null

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

  const amountPreview = useMemo(() => {
    let s = formData.amount.replace(/\s+/g, '')
    if (!s) return null
    while (s.endsWith('+') || s.endsWith('-') || s.endsWith('.')) s = s.slice(0, -1)
    if (!s) return null
    return evaluateAmountExpression(s)
  }, [formData.amount])

  const handleSubmit = async (behavior: 'close' | 'stay') => {
    if (!currentLedgerId) return

    const computed = evaluateAmountExpression(formData.amount)
    const amount = computed === null ? NaN : Math.abs(computed)
    if (isNaN(amount) || amount <= 0) {
      await dialog.alert({ title: '提示', message: '金额必须大于0' })
      return
    }
    if (amount > 999999.99) {
      await dialog.alert({ title: '提示', message: '金额不能超过999999.99' })
      return
    }

    const transactionData = {
      type: formData.type,
      amount: amount,
      categoryId: formData.categoryId,
      date: formData.date,
      note: formData.note,
      ledgerId: currentLedgerId,
      paymentMethod: formData.paymentMethod,
      tags: formData.tags,
    }

    if (editingTransaction) {
      await storage.updateTransaction(editingTransaction.id, transactionData)
      setEditingTransaction(null)
      resetForm()
      closeAdd()
    } else {
      try {
        await storage.addTransaction(transactionData)
        setLastTransactionData({
          type: formData.type,
          categoryId: formData.categoryId,
          paymentMethod: formData.paymentMethod,
          tags: formData.tags,
        })
        if (behavior === 'stay') {
          applyLastTransactionData()
        } else {
          resetForm()
          closeAdd()
        }
      } catch (error) {
        await dialog.alert({ title: '添加记录失败', message: error instanceof Error ? error.message : '添加记录失败' })
        return
      }
    }

    await refreshCurrentLedgerTransactions(currentLedgerId)
    const ids = selectedLedgerIds.length ? selectedLedgerIds : [currentLedgerId]
    setSelectedLedgerIds(ids)
    await refreshAccountsTransactions(ids)
    requestSync()
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      categoryId: transaction.categoryId,
      date: transaction.date,
      note: transaction.note,
      paymentMethod: transaction.paymentMethod || 'cash',
      tags: transaction.tags || [],
    })
  }

  const deleteTransactionNoConfirm = async (id: string) => {
    if (!currentLedgerId) return
    await storage.deleteTransaction(id)
    await refreshCurrentLedgerTransactions(currentLedgerId)
    const ids = selectedLedgerIds.length ? selectedLedgerIds : [currentLedgerId]
    setSelectedLedgerIds(ids)
    await refreshAccountsTransactions(ids)
    requestSync()
  }

  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      categoryId: '',
      date: new Date().toISOString().split('T')[0],
      note: '',
      paymentMethod: 'cash',
      tags: [],
    })
  }

  const addTagFromManage = async (name: string) => {
    if (!currentLedgerId) return
    const next = name.trim()
    if (!next) {
      dialog.toast({ message: '标签不能为空', kind: 'error' })
      return
    }
    if (tags.includes(next)) {
      dialog.toast({ message: '标签已存在', kind: 'info' })
      return
    }
    await storage.addTag(currentLedgerId, next)
    const allTags = await storage.getTags(currentLedgerId)
    setTags(allTags)
    dialog.toast({ message: '已添加标签', kind: 'success' })
  }

  const renameTagFromManage = async (oldName: string, newName: string) => {
    if (!currentLedgerId) return
    const next = newName.trim()
    if (!next) {
      dialog.toast({ message: '标签不能为空', kind: 'error' })
      return
    }
    if (oldName === next) return
    if (tags.includes(next)) {
      dialog.toast({ message: '标签已存在', kind: 'info' })
      return
    }
    await storage.renameTag(currentLedgerId, oldName, next)
    const allTags = await storage.getTags(currentLedgerId)
    setTags(allTags)
    await refreshCurrentLedgerTransactions(currentLedgerId)
    const ids = selectedLedgerIds.length ? selectedLedgerIds : [currentLedgerId]
    setSelectedLedgerIds(ids)
    await refreshAccountsTransactions(ids)
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.map((t) => (t === oldName ? next : t)),
    }))
    setLastTransactionData((prev) => (prev ? { ...prev, tags: prev.tags.map((t) => (t === oldName ? next : t)) } : prev))
    dialog.toast({ message: '已修改标签', kind: 'success' })
  }

  const deleteTagFromManage = async (tagName: string) => {
    if (!currentLedgerId) return
    await storage.deleteTagAndCleanup(currentLedgerId, tagName)
    const allTags = await storage.getTags(currentLedgerId)
    setTags(allTags)
    await refreshCurrentLedgerTransactions(currentLedgerId)
    const ids = selectedLedgerIds.length ? selectedLedgerIds : [currentLedgerId]
    setSelectedLedgerIds(ids)
    await refreshAccountsTransactions(ids)
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tagName) }))
    setLastTransactionData((prev) => (prev ? { ...prev, tags: prev.tags.filter((t) => t !== tagName) } : prev))
    dialog.toast({ message: '已删除标签', kind: 'success' })
  }

  const toggleTag = (tagName: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName]
    }))
  }

  const useTemplate = (template: Template) => {
    setFormData({
      type: template.type,
      amount: template.amount ? template.amount.toString() : '',
      categoryId: template.categoryId,
      date: new Date().toISOString().split('T')[0],
      note: template.note || '',
      paymentMethod: template.paymentMethod || 'cash',
      tags: template.tags || [],
    })
  }

  const refreshTemplates = async () => {
    if (!currentLedgerId) return
    const allTemplates = await storage.getTemplates(currentLedgerId)
    setTemplates(allTemplates)
  }

  const createTemplateFromBill = async (name: string, draft: { type: 'income' | 'expense'; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string }) => {
    if (!currentLedgerId) return null
    const nextName = name.trim()
    if (!nextName) return null
    if (templates.some((t) => t.ledgerId === currentLedgerId && t.name === nextName)) {
      dialog.toast({ message: '模板名称已存在', kind: 'info' })
      return null
    }
    const created = await storage.addTemplate({
      name: nextName,
      type: draft.type,
      amount: draft.amount || 0,
      categoryId: draft.categoryId || '',
      note: draft.note || '',
      paymentMethod: draft.paymentMethod || 'cash',
      tags: draft.tags || [],
      ledgerId: currentLedgerId,
    })
    await refreshTemplates()
    return created
  }

  const updateTemplateFromBill = async (
    templateId: string,
    patch: { name: string; amount: number; note: string; categoryId: string; tags: string[]; paymentMethod: string },
  ) => {
    if (!currentLedgerId) return
    const nameTrim = patch.name.trim()
    if (!nameTrim) {
      dialog.toast({ message: '模板名称不能为空', kind: 'error' })
      return
    }
    if (templates.some((t) => t.ledgerId === currentLedgerId && t.id !== templateId && t.name === nameTrim)) {
      dialog.toast({ message: '模板名称已存在', kind: 'info' })
      return
    }
    await storage.updateTemplate(templateId, {
      name: nameTrim,
      amount: patch.amount,
      note: patch.note,
      categoryId: patch.categoryId,
      tags: patch.tags,
      paymentMethod: patch.paymentMethod,
    })
    await refreshTemplates()
  }

  const deleteTemplateFromBill = async (templateId: string) => {
    if (!currentLedgerId) return
    await storage.deleteTemplate(templateId)
    await refreshTemplates()
  }

  const getLedgerById = (id: string) => ledgers.find(l => l.id === id)

  const filteredTransactions = searchQuery.trim() 
    ? transactions.filter(tx => 
        tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>
  }

  const currentLedger = getLedgerById(currentLedgerId || '')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const statsHeader = { year: currentYear, month: currentMonth }

  const newLedgerModal = showNewLedgerModal && (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
    }} onClick={() => setShowNewLedgerModal(false)}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        minWidth: '300px',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0' }}>新建账本</h3>
        <input
          type="text"
          placeholder="输入账本名称"
          value={newLedgerName}
          onChange={(e) => setNewLedgerName(e.target.value.substring(0, 30))}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
          onKeyPress={(e) => e.key === 'Enter' && createLedger()}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: 'white',
              cursor: 'pointer',
            }}
            type="button"
            onClick={() => {
              setShowNewLedgerModal(false)
              setNewLedgerName('')
            }}
          >
            取消
          </button>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#3498db',
              color: 'white',
              cursor: 'pointer',
            }}
            type="button"
            onClick={createLedger}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  )

  const ledgerSheet = showLedgerSheet && (
    <div className="sheet-backdrop" onClick={() => setShowLedgerSheet(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">选择账本</div>
        <div className="sheet__list">
          {ledgers.map((ledger) => {
            const active = ledger.id === currentLedgerId
            return (
              <button
                key={ledger.id}
                type="button"
                className={`sheet__item ${active ? 'sheet__item--active' : ''}`}
                onClick={() => {
                  switchLedger(ledger.id)
                  setShowLedgerSheet(false)
                }}
              >
                <span className="sheet__item-name">📒 {ledger.name}</span>
                <span className="sheet__item-actions">
                  {active && <span className="sheet__badge">当前</span>}
                  {ledgers.length > 1 && (
                    <button
                      type="button"
                      className="sheet__danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteLedger(ledger.id)
                      }}
                    >
                      删除
                    </button>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <div className="sheet__footer">
          <button
            type="button"
            className="sheet__primary"
            onClick={() => {
              setShowLedgerSheet(false)
              setShowNewLedgerModal(true)
            }}
          >
            + 新建账本
          </button>
        </div>
      </div>
    </div>
  )

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value)
    setVisibleTransactions(ITEMS_PER_PAGE)
  }

  const handleKeypadPress = (key: string) => {
    if (key === '⌫') {
      setFormData((prev) => ({ ...prev, amount: prev.amount.slice(0, -1) }))
      return
    }

    setFormData((prev) => {
      const currentAmount = prev.amount
      const last = currentAmount.slice(-1)
      const lastIsOp = last === '+' || last === '-'

      if (key === '+' || key === '-') {
        if (currentAmount === '' || currentAmount === '.' || currentAmount === '0.') return prev
        if (lastIsOp) return { ...prev, amount: currentAmount.slice(0, -1) + key }
        return { ...prev, amount: currentAmount + key }
      }

      if (key === '.') {
        const segment = currentAmount.split(/[+-]/).pop() || ''
        if (segment.includes('.')) return prev
        const next = segment === '' ? `${currentAmount}0.` : `${currentAmount}.`
        return { ...prev, amount: next }
      }

      const segment = currentAmount.split(/[+-]/).pop() || ''
      if (segment.includes('.')) {
        const decimals = segment.split('.')[1] || ''
        if (decimals.length >= 2) return prev
      }

      const nextAmount = currentAmount + key
      if (nextAmount.length > 20) return prev
      return { ...prev, amount: nextAmount }
    })
  }

  const openAdd = () => {
    setAddReturnTab(activeTab)
    setAddOpen(true)
    setAddView('add')
  }

  const closeAdd = () => {
    setAddOpen(false)
    setEditingTransaction(null)
    setLastTransactionData(null)
    resetForm()
    setAddView('add')
    setCategoryDetailId(null)
    setCategoryEditState(null)
    setActiveTab(addReturnTab)
  }

  const refreshCategories = async () => {
    if (!currentLedgerId) return
    const cats = await storage.getCategories(currentLedgerId)
    setCategories(cats)
  }

  const reorderMainCategories = async (orderedIds: string[]) => {
    if (!currentLedgerId) return
    const ids = orderedIds.slice()
    await Promise.all(ids.map((id, idx) => storage.updateCategory(id, { order: idx })))
    await refreshCategories()
  }

  const categoryDeleteGuard = (categoryId: string) => {
    const c = categories.find((x) => x.id === categoryId)
    if (!c) return { ok: false, reason: '分类不存在' }
    const hasChildren = categories.some((x) => x.parentId === c.id)
    if (hasChildren) return { ok: false, reason: '该主分类下仍有子分类，无法删除' }
    const used = transactions.some((t) => t.ledgerId === c.ledgerId && t.categoryId === c.id)
    if (used) return { ok: false, reason: '该分类已有记录使用，无法删除' }
    return { ok: true as const }
  }

  const deleteCategoryStrict = async (categoryId: string) => {
    const guard = categoryDeleteGuard(categoryId)
    if (!guard.ok) {
      await dialog.alert({ title: '无法删除', message: guard.reason })
      return
    }
    const c = categories.find((x) => x.id === categoryId)
    if (!c) return
    const ok = await dialog.confirm({ title: '删除分类', message: `确定要删除“${c.name}”吗？`, okText: '删除', cancelText: '取消' })
    if (!ok) return
    await storage.deleteCategory(categoryId, false)
    await refreshCategories()
    requestSync()
  }

  const saveCategory = async (payload: {
    mode: 'createMain' | 'createChild' | 'editMain' | 'editChild'
    id?: string
    type: 'income' | 'expense'
    name: string
    color: string
    icon?: string
    parentId: string | null
  }) => {
    if (!currentLedgerId) return
    const nameTrim = payload.name.trim()
    if (!nameTrim) {
      await dialog.alert({ title: '提示', message: '名称不能为空' })
      return
    }
    const dup = categories.some((c) => c.ledgerId === currentLedgerId && c.type === payload.type && c.parentId === payload.parentId && c.name === nameTrim && c.id !== payload.id)
    if (dup) {
      await dialog.alert({ title: '提示', message: '同级分类名称已存在' })
      return
    }
    if ((payload.mode === 'createChild' || payload.mode === 'editChild') && !payload.parentId) {
      await dialog.alert({ title: '提示', message: '请选择父分类' })
      return
    }

    if (payload.mode === 'editMain' || payload.mode === 'editChild') {
      if (!payload.id) return
      await storage.updateCategory(payload.id, {
        name: nameTrim,
        color: payload.color,
        icon: payload.icon,
        parentId: payload.parentId,
      })
      await refreshCategories()
      requestSync()
      if (categoryEditState?.returnTo === 'add') {
        setAddView('add')
      } else if (categoryEditState?.returnTo === 'categoryDetail') {
        setAddView('categoryDetail')
      } else {
        setAddView('categoryList')
      }
      setCategoryEditState(null)
      return
    }

    const created = await storage.addCategory({
      name: nameTrim,
      type: payload.type,
      color: payload.color,
      icon: payload.icon,
      order:
        categories
          .filter((c) => c.ledgerId === currentLedgerId && c.type === payload.type && c.parentId === payload.parentId)
          .reduce((max, c) => Math.max(max, typeof c.order === 'number' ? c.order : -1), -1) + 1,
      parentId: payload.parentId,
      ledgerId: currentLedgerId,
    })
    await refreshCategories()
    requestSync()
    if (categoryEditState?.returnTo === 'add') {
      setFormData((prev) => ({ ...prev, categoryId: created.id }))
      setAddView('add')
    } else if (categoryEditState?.returnTo === 'categoryDetail') {
      setAddView('categoryDetail')
    } else {
      setAddView('categoryList')
    }
    setCategoryEditState(null)
  }

  const pageTitle =
    activeTab === 'home' ? '🏠 首页' :
    activeTab === 'report' ? '📈 报表' :
    activeTab === 'stats' ? '📊 统计' :
    '👛 账户'

  if (!authChecked) {
    return <div className="app-shell" />
  }

  if (!authUsername) {
    return (
      <AuthPage
        onAuthed={(username) => {
          setAuthUsername(username)
          setAuthError(null)
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className={`app-content ${activeTab === 'home' ? 'app-content--home-lock' : ''}`}>
        <div className={`container ${activeTab === 'home' ? 'container--home' : ''}`}>
          <header className="header">
            <div className="topbar">
              {activeTab === 'accounts' ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="topbar__ledger"
                  onClick={() => setShowLedgerSheet(true)}
                  aria-label="选择账本"
                >
                  {currentLedger ? currentLedger.name : '选择账本'} <span aria-hidden="true">▾</span>
                </button>
              )}
              <h1 className="topbar__title">{pageTitle}</h1>
              <span style={{ width: '38px', height: '38px' }} />
            </div>
          </header>

          {activeTab === 'home' && (
            <div className="page--home">
              <HomePage
                monthlyStats={monthlyStats}
                transactions={filteredTransactions}
                categories={categories}
                paymentMethods={PAYMENT_METHODS}
                searchQuery={searchQuery}
                visibleTransactions={visibleTransactions}
                onSearchQueryChange={handleSearchQueryChange}
                onLoadMore={loadMoreTransactions}
                onOpenDetail={(tx) => setDetailTransaction(tx)}
                onGoAdd={openAdd}
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <StatsPage
              header={statsHeader}
              monthlyStats={monthlyStats}
              transactions={transactions}
              categories={categories}
              paymentMethods={PAYMENT_METHODS}
            />
          )}
          {activeTab === 'report' && (
            <ReportPage
              header={statsHeader}
              transactions={transactions}
              categories={categories}
              paymentMethods={PAYMENT_METHODS}
              onOpenDetail={(tx) => setDetailTransaction(tx)}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsPage
              transactions={accountsTransactions}
              paymentMethods={PAYMENT_METHODS}
              ledgers={ledgers}
              selectedLedgerIds={selectedLedgerIds}
              onToggleLedger={toggleLedgerSelection}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </div>
      </div>

      <SettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        authUsername={authUsername}
        authError={authError}
        onLogout={async () => {
          try {
            await apiPost('/auth/logout', {})
          } catch {
          } finally {
            setAuthUsername(null)
            setSettingsOpen(false)
          }
        }}
        syncStatus={syncStatus}
        onSyncNow={() => requestSync({ force: true })}
        currentLedgerId={currentLedgerId}
        onDataChanged={refreshAfterSync}
      />

      {newLedgerModal}
      {ledgerSheet}
      {detailTransaction && (
        <TransactionDetailSheet
          open={!!detailTransaction}
          transaction={detailTransaction}
          category={categories.find((c) => c.id === detailTransaction.categoryId)}
          paymentMethodName={PAYMENT_METHODS.find((m) => m.id === detailTransaction.paymentMethod)?.name}
          onClose={() => setDetailTransaction(null)}
          onEdit={() => {
            const run = () => {
              openAdd()
              handleEdit(detailTransaction)
              setDetailTransaction(null)
            }
            if (detailTransaction.ledgerId && detailTransaction.ledgerId !== currentLedgerId) {
              switchLedger(detailTransaction.ledgerId).then(run)
              return
            }
            run()
          }}
          onDelete={async () => {
            await deleteTransactionNoConfirm(detailTransaction.id)
          }}
        />
      )}
      {addOpen && addView === 'add' && (
        <AddPage
          title={editingTransaction ? '编辑记录' : '添加记录'}
          formData={formData}
          amountPreview={amountPreview}
          categories={categories}
          paymentMethods={PAYMENT_METHODS}
          tags={tags}
          templates={templates}
          editing={!!editingTransaction}
          onSave={handleSubmit}
          onFormChange={handleFormChange}
          onTypeChange={(type) => setFormData((prev) => ({ ...prev, type, categoryId: '' }))}
          onKeypadPress={handleKeypadPress}
          onToggleTag={toggleTag}
          onCategorySelect={(categoryId) => setFormData((prev) => ({ ...prev, categoryId }))}
          onQuickSetDate={(date) => setFormData((prev) => ({ ...prev, date }))}
          onUseTemplate={useTemplate}
          onOpenCategoryManagement={() => {
            setCategoryMgmtType(formData.type)
            setAddView('categoryList')
          }}
          onAddSubcategory={(parentId) => {
            setCategoryMgmtType(formData.type)
            setCategoryDetailId(parentId)
            setCategoryEditState({ mode: 'createChild', parentId, returnTo: 'add' })
            setAddView('categoryEdit')
          }}
          onUpdateTemplate={updateTemplateFromBill}
          onDeleteTemplate={deleteTemplateFromBill}
          onCreateTemplate={createTemplateFromBill}
          onAddTag={addTagFromManage}
          onRenameTag={renameTagFromManage}
          onDeleteTag={deleteTagFromManage}
          onCancelEdit={() => {
            setEditingTransaction(null)
            closeAdd()
          }}
          onClose={closeAdd}
          ledgerName={currentLedger ? currentLedger.name : '选择账本'}
          onOpenLedger={() => setShowLedgerSheet(true)}
        />
      )}

      {addOpen && addView === 'categoryList' && (
        <CategoryListPage
          type={categoryMgmtType}
          categories={categories}
          onTypeChange={setCategoryMgmtType}
          onBack={() => setAddView('add')}
          onOpenDetail={(categoryId) => {
            setCategoryDetailId(categoryId)
            setAddView('categoryDetail')
          }}
          onAdd={() => {
            setCategoryEditState({ mode: 'createMain', returnTo: 'categoryList' })
            setAddView('categoryEdit')
          }}
          onEdit={(categoryId) => {
            setCategoryEditState({ mode: 'editMain', categoryId, returnTo: 'categoryList' })
            setAddView('categoryEdit')
          }}
          onDelete={deleteCategoryStrict}
          onReorder={reorderMainCategories}
        />
      )}

      {addOpen && addView === 'categoryDetail' && categoryDetailId && (
        <CategoryDetailPage
          categoryId={categoryDetailId}
          categories={categories}
          onBack={() => setAddView('categoryList')}
          onEditMain={(categoryId) => {
            setCategoryEditState({ mode: 'editMain', categoryId, returnTo: 'categoryDetail' })
            setAddView('categoryEdit')
          }}
          onEditChild={(categoryId) => {
            setCategoryEditState({ mode: 'editChild', categoryId, returnTo: 'categoryDetail' })
            setAddView('categoryEdit')
          }}
          onDeleteChild={deleteCategoryStrict}
          onAddChild={(parentId) => {
            setCategoryEditState({ mode: 'createChild', parentId, returnTo: 'categoryDetail' })
            setAddView('categoryEdit')
          }}
        />
      )}

      {addOpen && addView === 'categoryEdit' && categoryEditState && (
        <CategoryEditPage
          mode={categoryEditState.mode}
          type={categoryMgmtType}
          categoryId={categoryEditState.categoryId}
          parentId={categoryEditState.parentId}
          categories={categories}
          onBack={() => {
            setCategoryEditState(null)
            setAddView(categoryEditState.returnTo)
          }}
          onSave={saveCategory}
        />
      )}
      <BottomNav value={activeTab} onChange={setActiveTab} onAdd={openAdd} />
    </div>
  )
}

export default App
