# Feature: Business Tokens (Stage 1 step 5)

- **Status**: Done
- **Author**: BoyangJiao + Claude
- **Created**: 2026-05-14
- **Implements**: ADR 003 v3.1 §决策四 / §决策五、CLAUDE.md §六、user-journeys J5
- **Conforms to**: `.specify/constitution.md`（涨跌色铁律）、ADR 005 色阶系统

---

## Why

ADR 003 v3.1 把 Arc design token 拆为 Foundation（HeroUI Native + Pro + Arc 扩 7 = 38）+ Business（5 + 派生 ≈ 20）平行结构。Business 层是金融业务专属语义层（gain / loss / pnlNeutral / deviationWarning / deviationCritical），由用户偏好（红涨绿跌 vs 绿涨红跌）动态映射到 Foundation。

Stage 1 J5 验收要求"切换涨跌色 → 涨幅数字从绿变红、跌幅从红变绿"。本 step 提供：

1. Business token 类型定义（窄类型，IDE 自动补全）
2. `buildBusinessTokens(mode)` 纯函数（可测试）
3. Tailwind v4 字面量 className 映射（编译期可见）
4. React Context + 3 个 hooks（运行时切换）
5. ESLint 规则禁止硬编码颜色绕过 token 体系
6. Property tests 守护切换契约

---

## 已完成

### `apps/mobile/global.css`

（在前置 commit 中已就位 — ADR 005 色阶 + ADR 003 Foundation override + Arc 扩 7 个 token）

- 6 个 OKLCH 色阶：brand / green / red / orange / blue / neutral × 11 stops
- 4 个 primitive 常量：white / black / snow / eclipse
- HeroUI Foundation override 用 `var(--color-XXX-NNN)` 引色阶
- Arc 扩 7 个 token：`info` / `info-foreground` / `skeleton` + 5 套 `*-pressed`（accent / success / warning / danger / default）
- Light / Dark 双模式

### `packages/ui/src/tokens/business.ts`

- 类型：`FinanceColorMode`、`BusinessTokenMap`、`FoundationStatusToken`、`FoundationSoftToken`
- 常量：`DEFAULT_FINANCE_COLOR_MODE = 'greenUpRedDown'`（与 packages/db user_preferences 默认对齐）
- 纯函数：`buildBusinessTokens(mode)` — 可在非 React 环境用（如服务端 / 测试）

### `packages/ui/src/tokens/business-classes.ts`

- `BusinessClassSet` / `BusinessClassMap` 类型
- `buildBusinessClasses(mode)` 返回字面量 className 映射（Tailwind v4 编译可扫描）
- `tokenToClasses(token)` 反向工具（已知 token 名时拿 className）
- **关键**：所有 `text-success` / `bg-success-soft` / `text-danger` / `bg-warning-soft` 等 className 都以**字面量字符串**存在，避免动态拼接导致 Tailwind 编译漏类

### `packages/ui/src/tokens/business-context.tsx`

- `<BusinessTokensProvider mode={...}>` — 注入用户偏好
- `useBusinessTokens()` — 拿 token 名映射（`{ gain: 'success' | 'danger', ... }`）
- `useBusinessClasses()` — 拿 Tailwind 字面量 className 映射（**业务首选**）
- `useFinanceColorMode()` — 直接读 mode（高级用法）

### `packages/ui/src/tokens/index.ts`

- Barrel 导出全部 Business 公共 API
- 注释含 ADR 003 v3.1 §决策二 消费规则速查

### `packages/ui/__tests__/business-tokens.spec.ts`

- 14 个 property + unit tests，全部 pass
- 覆盖：默认值、双模式映射、gain/loss 互反性、pnlNeutral 不变性、deviation 不变性、Tailwind 字面量、反向工具一致性、Foundation 不参与切换

### `eslint.config.mjs`

新增 3 条规则（仅作用于 apps/ + packages/，例外 tools/ + tokens/ + tests）：

- 禁止 hex 字面量（`#fff` / `#112233` / `#1234abff`）
- 禁止 oklch / rgb / rgba / hsl / hsla 函数字面量
- 禁止 Tailwind 内置色 utility（`bg-red-500` / `text-blue-300` / 任何 `(bg|text|border|...)-(red|orange|amber|yellow|...)-(\\d+)`）

错误信息直接指向 ADR 003 v3.1 §决策七，引导开发者去查文档。

---

## 业务消费 API（速查）

```tsx
// 1. 在 RootLayout 挂 Provider（Stage 1 J5 实施时接入 user_preferences）
import { BusinessTokensProvider } from "@arc/ui";

function RootLayout() {
  // const prefs = useUserPreferences();  // Stage 1 后期接入
  return (
    <BusinessTokensProvider mode="greenUpRedDown">
      <Stack />
    </BusinessTokensProvider>
  );
}

// 2. 业务组件用 useBusinessClasses()
import { useBusinessClasses, Text } from "@arc/ui";

function PnLBadge({ change }: { change: number }) {
  const classes = useBusinessClasses();
  const sign = change > 0 ? "gain" : change < 0 ? "loss" : "pnlNeutral";

  if (sign === "pnlNeutral") {
    return <Text className={classes.pnlNeutral.text}>{change}%</Text>;
  }

  return (
    <View className={classes[sign].bgSoft + " px-2 py-1 rounded-md"}>
      <Text className={classes[sign].text}>
        {change > 0 ? "+" : ""}
        {change}%
      </Text>
    </View>
  );
}

// 3. 偏离度徽章
function DeviationBadge({ pct }: { pct: number }) {
  const classes = useBusinessClasses();
  const abs = Math.abs(pct);
  if (abs <= 5) return null;
  const variant = abs > 10 ? "deviationCritical" : "deviationWarning";
  return (
    <View className={classes[variant].bgSoft + " px-2 py-1"}>
      <Text className={classes[variant].textOnSoft}>偏离 {pct}%</Text>
    </View>
  );
}
```

---

## 反例（ESLint 会拦下）

```tsx
// ❌ Hex 字面量
<View style={{ backgroundColor: "#FF5555" }} />

// ❌ Tailwind 内置色（绕过 Arc 色阶）
<Text className="text-red-500">+2.3%</Text>

// ❌ 用 Foundation 直接表达涨跌（违反 ADR 003 §决策二业务消费规则；
//    Stage 1 末加 custom rule 拦此模式）
<Text className="text-success">+2.3%</Text>

// ❌ 动态拼接 Tailwind 类（编译期看不到）
const cls = `text-${tokens.gain}`;  // 不会生成 CSS

// ✅ 正确写法
const classes = useBusinessClasses();
<Text className={classes.gain.text}>+2.3%</Text>;
```

---

## 验证

```bash
# 1. Property tests（红涨绿跌契约守护）
pnpm --filter @arc/ui test
# 预期：14/14 passed

# 2. typecheck 全 workspace
pnpm typecheck
# 预期：6/6 successful

# 3. lint
pnpm lint
# 预期：no error；写一段反例（如 "text-red-500"）lint 应报错并指向 ADR 003 v3.1

# 4. 手动验证（在 mobile app 加一个临时 PnLBadge，切 Provider mode 看颜色翻转）
```

---

## 不在本 step 范围（依赖下游 step）

- 真实接入 `user_preferences.finance_color_mode`（Provider 拿 mode 的来源）→ Stage 1 step 4 业务页面 / Stage 1 末 J5 实施
- Settings 页面 J5 涨跌色切换 UI → Stage 1 step 4
- `<RedactedNumber>` 脱敏组件（J16 Stage 3）→ 不在 Stage 1 范围
- 「自定义业务域」（如 `promotion`、`ai-glow`）→ 按需 Stage 3+ 加，复用本 step 的 5-token + 派生模式
