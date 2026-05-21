# AKShare wrapper (Vercel Python)

Arc Stage 3 Phase 2：为 `HK` / `FUND`（以及 CN fallback）提供 HTTP 行情。Mobile 通过 `EXPO_PUBLIC_AKSHARE_WRAPPER_*` 调用，不直连 AKShare。

## 一、部署到 Vercel（首次）

### 1. 安装 CLI 并登录

```bash
npm i -g vercel
vercel login
```

### 2. 进入本目录并关联项目

```bash
cd services/akshare-wrapper
vercel link
```

- **Create new project** → 建议名：`arc-akshare-wrapper`
- Root directory：保持当前目录（`services/akshare-wrapper`）

### 3. 设置鉴权 Token（与 App 共用同一串）

本地生成一串随机密钥（不要提交 Git）：

```bash
openssl rand -hex 32
```

写入 Vercel 环境变量（三个环境都加，避免 preview 401）：

```bash
vercel env add AKSHARE_WRAPPER_TOKEN
# 粘贴上面生成的 token，依次选 Production / Preview / Development
```

### 4. 部署

```bash
vercel deploy --prod
```

**`vercel.json` 要点**（纯 Python 子项目必须用显式 `builds`，勿只靠 `functions` glob）：

- Python 版本：根目录 `.python-version`（`3.12`）
- 共享逻辑放在 `lib/`，**不要**放在 `api/_shared/`（否则 Vercel 不把 `api/*.py` 识别为函数）
- 若报 `Function Runtimes must have a valid version`：勿写 `"runtime": "python3.12"`
- 若报 `functions pattern doesn't match`：改用仓库内 `builds` + `routes`（见 `vercel.json`）

记下输出里的生产 URL，例如：`https://arc-akshare-wrapper.vercel.app`（稳定别名，非每次 deploy 的 `*-xxx.vercel.app` 预览域）

### 5. 冒烟测试（本机终端）

```bash
export WRAPPER_URL="https://你的项目.vercel.app"
export WRAPPER_TOKEN="你的 token"

curl -sS -H "X-Arc-Token: $WRAPPER_TOKEN" \
  "$WRAPPER_URL/api/quote?market=HK&symbol=00700" | head -c 500
```

期望 JSON 含 `"assetId":"HK:00700"`、`"currency":"HKD"`、`"price":"..."`。

CN / FUND 同理：

```bash
curl -sS -H "X-Arc-Token: $WRAPPER_TOKEN" \
  "$WRAPPER_URL/api/quote?market=CN&symbol=600519"

curl -sS -H "X-Arc-Token: $WRAPPER_TOKEN" \
  "$WRAPPER_URL/api/quote?market=FUND&symbol=000001"
```

> **注意**：Hobby 计划函数超时 10s；AKShare + pandas 冷启动可能较慢，首次失败可重试。若反复 504，见文末「故障排查」。

---

## 二、配置 Arc Mobile

编辑 `apps/mobile/.env`（勿提交）：

```bash
EXPO_PUBLIC_AKSHARE_WRAPPER_URL=https://你的项目.vercel.app
EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN=与 Vercel 相同的 AKSHARE_WRAPPER_TOKEN
# 可选；默认 true — Tushare 限流/积分不足时 CN 走 AKShare
EXPO_PUBLIC_ENABLE_AKSHARE_CN_FALLBACK=true
```

**重启 Metro**（改 env 后必须）：

```bash
pnpm mobile
```

Simulator：**⌘D → Reload**。

---

## 三、App 内验证

1. DEV → **A股 / 港股 / 基金** → **仅港股 (00700)** 或 **仅基金**
2. 打开组合页 → **下拉刷新**
3. 应看到 HKD / CNY 真实价（来源 `akshare-hk` / `akshare-fund`）

已有 Tushare CN 持仓时，wrapper 主要解锁 **HK / FUND**；CN 在 Tushare 失败时才会 fallback（需 `ENABLE_AKSHARE_CN_FALLBACK` 非 false）。

---

## API

| 路径                                                        | 说明                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /api/quote?market=CN\|HK\|FUND&symbol=...`             | 最新价；Header `X-Arc-Token`                                                    |
| `GET /api/historical?market=...&symbol=...&from=ISO&to=ISO` | 日期窗口拉取（YYYY-MM-DD 解析）；`from`/`to` 缺一时回退为单日数组（兼容旧调用） |
| `GET /api/search?market=CN\|HK\|FUND&q=...`                 | Symbol search（最多 8 条）；模块级 24h DataFrame 缓存                           |

错误：401 未授权 / 403 token 不匹配 / 404 标的 / 503 + Retry-After 上游瞬时 / **500 wrapper 内部错（不重试）**。

---

## 故障排查

| 现象                                    | 处理                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| App 报 `no price adapter for market HK` | 检查 `EXPO_PUBLIC_AKSHARE_WRAPPER_URL` 是否填、Metro 是否重启                       |
| curl 401                                | Token 与 Vercel env、`.env` 不一致                                                  |
| curl 503 / 超时                         | 冷启动或东方财富源波动；重试；必要时 Vercel Pro 加长 `maxDuration`                  |
| 部署失败 `Module not found`             | 确认 `requirements.txt` 在仓库内；重新 `vercel deploy`                              |
| `functions` pattern doesn't match       | 勿把共享代码放在 `api/` 下（用 `lib/`）；`vercel.json` 只指向 `api/quote.py` 等入口 |
| 仅自用                                  | 勿公开 URL；Token 等同 API Key，泄露后在 Vercel 轮换                                |

---

## 法务（Stage 3 自用）

见 `docs/adr/011-multi-source-fallback-and-akshare.md` 决策四：当前为单用户自用；Stage 4 公开发布前需复审或 sunset AKShare 链。
