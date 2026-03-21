# 群晖部署（v1.3）

这套部署以两个容器为核心：
- `accounting-backend`：FastAPI 后端 + SQLite（挂载到 NAS）
- `accounting-cloudflared`：Cloudflare Tunnel 出公网（HTTPS）

## 目录说明
- `deploy/docker-compose.yml`：群晖 Container Manager 项目配置
- `deploy/.env.example`：需要填写的环境变量模板

## 1) 准备 Cloudflare Tunnel
在 Cloudflare Zero Trust 创建 Tunnel，并为你的域名配置 Public Hostname：
- Hostname：例如 `acc.example.com`
- Service：`http://accounting-backend:8000`

创建完成后会拿到一个 Token（Tunnel token），后面写进 `CLOUDFLARED_TOKEN`。

## 2) 群晖 Container Manager 创建项目
1. 打开 Container Manager -> 项目 -> 新增
2. 选择 `deploy/docker-compose.yml`
2.1 若项目报错 `unable to prepare context: path \"../backend\" not found`，说明群晖上缺少后端源码目录。将本仓库的 `backend/` 目录上传到群晖，使其与 `deploy/` 同级，例如：
   - `/volume1/docker/accounting/deploy/docker-compose.yml`
   - `/volume1/docker/accounting/backend/Dockerfile`
   - `/volume1/docker/accounting/backend/app/...`
3. 配置环境变量（可用 `.env` 文件或在 UI 里填）：
   - `CLOUDFLARED_TOKEN`：必填
   - `ACCOUNTING_SETUP_KEY`：可选，用于首次创建邀请码时的安全限制（建议填一个随机字符串）
   - `ACCOUNTING_CORS_ORIGINS`：建议填写前端域名（多个用逗号分隔），用于限制跨域访问（例如 `https://acc.example.com`）
   - `ACCOUNTING_COOKIE_DOMAIN`：当前端与后端使用子域名（例如 `app.example.com` + `acc.example.com`）时，建议设置为 `.example.com`，用于让 `csrf_token` 可被前端读取并通过 `x-csrf-token` 发送（否则同步/退出登录可能报 `csrf_required`）
4. 启动项目

启动后：
- 后端容器对宿主机仅绑定 `127.0.0.1:8031`（仅本机可访问），外网通过 cloudflared 转发

## 3) 数据落盘位置（NAS）
当前 compose 使用具名卷：
- `accounting_data` -> 容器内 `/data`
- `accounting_logs` -> 容器内 `/logs`

如果你更想落到指定目录（例如 `/volume1/docker/accounting/...`），可以把 `volumes:` 改成 bind mount，例如：
- `/volume1/docker/accounting/data:/data`
- `/volume1/docker/accounting/logs:/logs`

## 4) 首次注册流程（单账号）
v1.3 为单账号模式，建议按如下顺序：
1. 打开前端，走“使用邀请码注册”
2. 点击“获取初始邀请码（仅首次）”
3. 注册并登录

注意：首次引导邀请码仅在“服务端还没有任何用户”时可用。
