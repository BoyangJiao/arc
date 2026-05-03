# 启动前准备清单（Pre-flight Checklist）

> **目的**：在 Stage 1 写第一行代码之前，把所有「写代码也用得上但写代码不能解决」的事先做完。
>
> **预算总览**：MVP 阶段一次性 ≈ ¥800-1500，月度 < ¥30。详见各项备注。

---

## 一、账号与服务（必备）

### 开发协作
- [ ] **GitHub 账号** + 私有仓库 `delta`（免费足够）
- [ ] **Claude Code** 已安装并能跑（你已在用）
- [ ] **VS Code / Cursor** + 必备插件（ESLint、Prettier、Tailwind IntelliSense）

### 设计
- [ ] **Figma 企业版**（你公司提供 ✅）
- [ ] **HeroUI Pro 账号**（已购 ✅）确认有 React Native 资产访问权
- [ ] **icon 资源**：选一套 free（Lucide、Phosphor）+ 自己画几个领域图标

### 后端基础设施
- [ ] **Supabase 账号** + 项目（免费层 500MB DB / 1GB storage）
  - 区域选 `ap-southeast-1`（新加坡，国内访问最快）
  - 启用 Row Level Security
- [ ] **Vercel 账号**（用 GitHub 登录）
- [ ] **EAS（Expo）账号**（免费 30 builds/月）

### 数据源
- [ ] **Tushare Pro 账号** —— 注册 + 实名认证 + 选 ≥120 积分档（≈ ¥200/年）
  - 要点：实名认证后才有日级历史数据接口
- [ ] **Alpha Vantage 免费 key**（美股 25 calls/day）
- [ ] **CoinGecko**（不需要 key）
- [ ] **exchangerate.host**（不需要 key）
- [ ] 备选：**OpenExchangeRates**（汇率付费，$12/月，仅在免费源不稳定时启用）

### 监控与分析
- [ ] **Sentry 账号**（免费 5K events/月）
- [ ] **PostHog 账号**（免费 1M events/月）

### 应用商店（Stage 4 才用，可推迟）
- [ ] **Apple Developer Program** ($99/年，约 ¥718)
- [ ] 国内安卓商店（华为/小米/OPPO/vivo/应用宝，均免费但需材料）

### 域名（Stage 0 末敲定产品名后）
- [ ] **域名注册**（建议 .com + .app 各一，约 ¥80-200/年）
  - 国内主备案（推迟到 Stage 4）
  - 海外建议 Cloudflare Registrar（成本价）

### AI（Stage 4 才用）
- [ ] **Anthropic API key**（按用量计费；Stage 4 起预算 < $20/月）

---

## 二、本地开发环境

- [ ] **Node.js 20+** 通过 `nvm` 安装
- [ ] **pnpm** `npm i -g pnpm`
- [ ] **Xcode**（macOS 必备，用于 iOS 模拟器和签名）
- [ ] **Android Studio**（可选；Stage 1 可只跑 iOS + Web）
- [ ] **Supabase CLI** `brew install supabase/tap/supabase`
- [ ] **EAS CLI** `pnpm i -g eas-cli`
- [ ] **Git LFS**（如果存设计稿；建议设计稿放 Figma，代码仓不存）

### IDE 配置（建议）
- [ ] ESLint + Prettier + EditorConfig 配置文件
- [ ] `.vscode/settings.json` 提交到仓库（统一格式化行为）
- [ ] `.gitignore` 包含 `.env*`、`node_modules`、`.expo/`、`ios/Pods`

---

## 三、设计资产

> 这一节是你的强项，列项是为了避免遗漏。

- [ ] **产品名定下来**（详见 §五）
- [ ] **品牌色** + **强调色**（建议至少 3 候选 → A/B 自评）
- [ ] **暗色 + 亮色 主题完整 token**（颜色/字号/间距）
- [ ] **图标**：app icon (1024x1024) + 启动屏 + 12 个核心功能图标
- [ ] **关键页 Figma**：
  - [ ] Sign in / Onboarding（3 步）
  - [ ] Portfolio list
  - [ ] Portfolio detail（含环形图）
  - [ ] Asset detail
  - [ ] Add transaction
  - [ ] Rebalance view
  - [ ] Settings
- [ ] **空状态、错误状态、加载状态**（金融 App 的可信度来自这些）
- [ ] **CSV 导入模板**（一份 Numbers/Excel 文件，列：market, symbol, type, shares, price, currency, trade_date）

---

## 四、内容资产

- [ ] **隐私政策初稿**（用 generator 起，标记「待律师 review」）
- [ ] **用户协议初稿**（同上）
- [ ] **产品边界声明**（参考 `project-background.md` §七，照搬即可）
- [ ] **常见问题 FAQ**（10 条，覆盖「数据安全」「准确性」「订阅退款」）
- [ ] **App Store / Google Play 描述文案**（中英双语，Stage 4 之前可用占位）

---

## 五、产品命名

> 重要决策，建议在 Stage 0 用一整周做。

### 5.1 命名标准
- 中英文都好读、好拼
- App Store 在中国区与海外区都没重名
- `.com` `.app` 至少有一个能注册
- 不含「金融 / 投资 / 财经 / Invest / Finance」等敏感词（合规友好）
- 不含具体资产类别（避免未来扩展受限）

### 5.2 命名脑暴方向（仅供启发）
- 几何/天文：Orbit、Polestar、Compass、Meridian
- 平衡/比例：Equipoise、Counterweight、Tare
- 全景/视图：Vista、Panorama、Loupe
- 中性虚词：Folio、Tally、Index

### 5.3 命名验证流程
```
脑暴 20 个 → 自评筛 8 个 → 域名查询淘汰 → App Store 重名查询淘汰 →
中国商标初查（中国商标网）→ 念给 5 个朋友听 → 终选
```

---

## 六、资金预算

| 项 | 金额 | 时点 |
|:---|:---|:---|
| Tushare Pro 入门档 | ¥200/年 | Stage 0 |
| 域名（.com + .app） | ¥120-200/年 | Stage 0 末 |
| Apple Developer | ¥718/年 | Stage 4 前 |
| 软件著作权代办 | ¥300-1000 一次 | Stage 4 |
| 律师初步咨询（金融科技方向） | ¥3,000-10,000 一次 | PMF 信号后 |
| 公司注册（如推进） | ¥1,000-3,000 一次 | PMF 信号后 |
| **MVP 阶段（Stage 0-3）合计** | **≈ ¥1,000** | |
| **V1.0 上线前合计** | **+ ¥4,000-15,000**（含合规与公司） | |

---

## 七、文档与决策记录

- [ ] 创建 `docs/adr/` 目录
- [ ] 第一篇 ADR：`001-tech-stack.md`（记录 Expo + Supabase + HeroUI 的选型决策）
- [ ] 第二篇 ADR：`002-data-model.md`（记录 §五的关键决策）
- [ ] 第三篇 ADR：`003-data-sources.md`（记录数据源选型与限流策略）

---

## 八、心理与时间

- [ ] **承认这是兼职项目**：6-12h/周是上限不是下限。设期望比死磕进度健康。
- [ ] **设硬截止日**：MVP-1 自用版有一个具体日期（如「2026-08-31 之前我自己日用」）
- [ ] **设暂停规则**：连续 2 周时间投入 < 3h → 主动暂停 1 周补能量，不要硬撑
- [ ] **告诉至少 1 个朋友你在做什么**：social commitment 强化执行
- [ ] **每月一次自评**：进度、心情、是否仍想做

---

## 九、勾选进度

完成数：☐ / 60+

> 全部勾完之前不进入 Stage 1。