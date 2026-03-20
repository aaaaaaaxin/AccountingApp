import { useState } from 'react'
import { apiGet, apiPost } from '../../utils/api'

export function AuthPage(props: { onAuthed: (username: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'register') {
        await apiPost('/auth/register', { username, password, invite_code: inviteCode })
      }
      await apiPost('/auth/login', { username, password })
      const me = await apiGet<{ username: string }>('/auth/me')
      props.onAuthed(me.username)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '18px' }}>登录</h1>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setMode((m) => (m === 'login' ? 'register' : 'login'))
            }}
            style={{ background: 'transparent', border: 'none', color: '#1677ff', cursor: 'pointer' }}
          >
            {mode === 'login' ? '使用邀请码注册' : '返回登录'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 50))}
            placeholder="用户名"
            autoComplete="username"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd' }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 8 位）"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            type="password"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd' }}
          />
          {mode === 'register' && (
            <>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.trim())}
                placeholder="邀请码"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd' }}
              />
              <input
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                placeholder="初始化密钥（可选，用于获取初始邀请码）"
                type="password"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd' }}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  if (submitting) return
                  setSubmitting(true)
                  setError(null)
                  try {
                    const boot = await apiPost<{ code: string }>('/admin/invites/bootstrap', {}, setupKey ? { 'x-setup-key': setupKey } : undefined)
                    setInviteCode(boot.code)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '获取邀请码失败')
                  } finally {
                    setSubmitting(false)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                获取初始邀请码（仅首次）
              </button>
            </>
          )}
          {error && <div style={{ color: '#d63031', fontSize: '13px' }}>{error}</div>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: 'none',
              background: '#1677ff',
              color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </div>

        <div style={{ marginTop: '12px', color: '#666', fontSize: '12px', lineHeight: 1.5 }}>
          <div>需要邀请码才能注册。</div>
          <div>登录后可在“账户”页看到同步状态与邀请码管理入口。</div>
        </div>
      </div>
    </div>
  )
}
