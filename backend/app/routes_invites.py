from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .deps import get_current_user, get_db, require_csrf, require_setup_allowed
from .security import iso_utc, new_id, now_utc, parse_iso


router = APIRouter(prefix="/admin/invites", tags=["invites"])


class GenerateInviteBody(BaseModel):
  days: int | None = None


def _invite_status(row) -> str:
  if row["revoked_at"] is not None:
    return "revoked"
  if row["used_at"] is not None:
    return "used"
  if now_utc() >= parse_iso(row["expires_at"]):
    return "expired"
  return "active"


@router.post("/bootstrap")
def bootstrap_generate(db=Depends(get_db), _=Depends(require_setup_allowed)) -> dict:
  created = now_utc()
  expires = created + timedelta(days=7)
  code = new_id()
  db.execute(
    "INSERT INTO invite_codes (code, created_at, expires_at, used_at, used_by_user_id, revoked_at) VALUES (?, ?, ?, NULL, NULL, NULL)",
    (code, iso_utc(created), iso_utc(expires)),
  )
  db.commit()
  return {"code": code, "expires_at": iso_utc(expires)}


@router.get("")
def list_invites(db=Depends(get_db), user=Depends(get_current_user)) -> dict:
  cur = db.execute(
    """
    SELECT code, created_at, expires_at, used_at, used_by_user_id, revoked_at
    FROM invite_codes
    ORDER BY created_at DESC
    LIMIT 200
    """
  )
  rows = cur.fetchall()
  items = []
  for r in rows:
    items.append(
      {
        "code": r["code"],
        "created_at": r["created_at"],
        "expires_at": r["expires_at"],
        "used_at": r["used_at"],
        "used_by_user_id": r["used_by_user_id"],
        "revoked_at": r["revoked_at"],
        "status": _invite_status(r),
      }
    )
  return {"items": items}


@router.post("/generate")
def generate_invite(body: GenerateInviteBody, db=Depends(get_db), user=Depends(get_current_user), _=Depends(require_csrf)) -> dict:
  days = body.days if body.days is not None else 7
  if days <= 0 or days > 30:
    raise HTTPException(status_code=400, detail="invalid_days")
  created = now_utc()
  expires = created + timedelta(days=days)
  code = new_id()
  db.execute(
    "INSERT INTO invite_codes (code, created_at, expires_at, used_at, used_by_user_id, revoked_at) VALUES (?, ?, ?, NULL, NULL, NULL)",
    (code, iso_utc(created), iso_utc(expires)),
  )
  db.commit()
  return {"code": code, "expires_at": iso_utc(expires)}


@router.post("/{code}/revoke")
def revoke_invite(code: str, db=Depends(get_db), user=Depends(get_current_user), _=Depends(require_csrf)) -> dict:
  cur = db.execute("SELECT code, used_at, revoked_at FROM invite_codes WHERE code = ?", (code,))
  row = cur.fetchone()
  if not row:
    raise HTTPException(status_code=404, detail="not_found")
  if row["revoked_at"] is not None:
    return {"status": "ok"}
  if row["used_at"] is not None:
    raise HTTPException(status_code=400, detail="already_used")
  db.execute("UPDATE invite_codes SET revoked_at = ? WHERE code = ?", (iso_utc(now_utc()), code))
  db.commit()
  return {"status": "ok"}


@router.get("/page")
def invites_page(request: Request, user=Depends(get_current_user)) -> HTMLResponse:
  return HTMLResponse(
    content="""
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>邀请码管理</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:920px;margin:24px auto;padding:0 16px;}
    .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
    button{padding:8px 12px;border-radius:10px;border:1px solid #ddd;background:#fff;cursor:pointer;}
    button.primary{background:#1677ff;color:#fff;border:none;}
    table{width:100%;border-collapse:collapse;margin-top:16px;}
    th,td{border-bottom:1px solid #eee;padding:10px;text-align:left;font-size:14px;}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;}
    .muted{color:#666;font-size:12px;}
  </style>
</head>
<body>
  <h1>邀请码管理</h1>
  <div class="row">
    <button class="primary" id="btn-generate">生成邀请码（7天）</button>
    <button id="btn-refresh">刷新列表</button>
    <span class="muted" id="msg"></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>邀请码</th>
        <th>状态</th>
        <th>过期时间</th>
        <th>使用时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <script>
    function getCookie(name){
      const m = document.cookie.match('(?:^|; )' + name.replace(/([.$?*|{}()[\\]\\\\/+^])/g,'\\\\$1') + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : null;
    }
    async function api(path, opts){
      const csrf = getCookie('csrf_token');
      const headers = Object.assign({'Content-Type':'application/json'}, opts && opts.headers ? opts.headers : {});
      if(opts && opts.method && opts.method !== 'GET' && opts.method !== 'HEAD'){
        if(csrf) headers['x-csrf-token'] = csrf;
      }
      const res = await fetch(path, Object.assign({credentials:'include', headers}, opts || {}));
      const text = await res.text();
      let data = null;
      try{ data = JSON.parse(text); }catch(e){}
      if(!res.ok){
        throw new Error((data && data.detail) ? data.detail : ('http_' + res.status));
      }
      return data;
    }
    function setMsg(s){ document.getElementById('msg').textContent = s || ''; }
    function fmt(s){ return s ? s.replace('T',' ').replace('Z','') : ''; }
    async function refresh(){
      setMsg('加载中...');
      const data = await api('/admin/invites');
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = '';
      for(const it of data.items){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><code>' + it.code + '</code></td>' +
          '<td>' + it.status + '</td>' +
          '<td>' + fmt(it.expires_at) + '</td>' +
          '<td>' + fmt(it.used_at) + '</td>' +
          '<td>' + (it.status === 'active' ? '<button data-code=\"'+it.code+'\">作废</button>' : '') + '</td>';
        tbody.appendChild(tr);
      }
      setMsg('');
    }
    document.getElementById('btn-refresh').addEventListener('click', () => refresh().catch(e => setMsg(e.message)));
    document.getElementById('btn-generate').addEventListener('click', async () => {
      try{
        const data = await api('/admin/invites/generate', {method:'POST', body: JSON.stringify({days:7})});
        setMsg('已生成：' + data.code);
        await refresh();
      }catch(e){ setMsg(e.message); }
    });
    document.getElementById('tbody').addEventListener('click', async (e) => {
      const btn = e.target;
      if(btn.tagName !== 'BUTTON') return;
      const code = btn.getAttribute('data-code');
      if(!code) return;
      if(!confirm('确定作废该邀请码吗？')) return;
      try{
        await api('/admin/invites/' + encodeURIComponent(code) + '/revoke', {method:'POST', body:'{}'});
        await refresh();
      }catch(err){ setMsg(err.message); }
    });
    refresh().catch(e => setMsg(e.message));
  </script>
</body>
</html>
""".strip()
  )
