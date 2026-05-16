# ADR 005 — Tailwind v4 OKLCH 色阶系统

- **状态**: 已接受
- **日期**: 2026-05-13
- **作者**: BoyangJiao + Claude
- **相关 ADR**: 003 v3.1（Design Tokens 架构），002（UI 库选型）
- **配套文件**:
  - `tools/generate-color-scales.mjs` — 色阶生成器（OKLCH 算法）
  - `apps/mobile/global.css` — `@theme` Primitive 块 + Foundation override
  - `docs/archive/design.md.original` — HeroUI Pro Theme Builder 原始输出（已归档）

---

## 背景

ADR 003 v3 把 Primitive 层定义为 4 个常量（`white` / `black` / `snow` / `eclipse`）+ sizing token。这没问题作为"原材料"层，但留了一个隐患：

**HeroUI Native 的 Foundation 实际颜色值是 HeroUI 内部硬编码 hex**。Arc 没有一套色阶系统来支撑 Foundation 的派生与扩展。后果：

1. 任何 token 调整（如 brand 色微调）必须手改 hex
2. Light / Dark mode 是平行命名，**值彼此独立**，无系统化派生关系
3. 缺少色阶意味着 Component 层一旦需要"比 surface 浅一档但比 default 深一档"的 ad-hoc 颜色，只能硬编码或自建 `color-mix`
4. 没有色彩科学方法 — 不符合 Material 3 / Adobe Spectrum / Tailwind 等业界 DS 的工业标准

用户在使用 HeroUI Pro Theme Builder 生成 `docs/design/design.md` 后明确提出："理论上我们的所有颜色使用都应该是基于全套色阶的。基本色盘需要包含黑，白，品牌色 #50FF6C，绿，红，黄/橙，蓝，中性色"。

ADR 005 落实这个色阶系统。

---

## 决策

### 决策一：定义 6 个色阶 + 4 个常量

| Palette | Anchor（design.md 实测）| Anchor 落 stop | 用途 |
|:---|:---|:---:|:---|
| **brand** | `#50FF6C` = `oklch(88.15% 0.2375 145.76)` | 300 | HeroUI `accent` / `focus` / `chart-3` |
| **green** | `#64C33A` = `oklch(73.29% 0.1942 137.87)` | 500 | HeroUI `success` |
| **red** | `#FD3367` = `oklch(65.32% 0.2337 12.76)` | 500 | HeroUI `danger` |
| **orange** | `#FF9C3E` = `oklch(78.19% 0.1590 59.36)` | 400 | HeroUI `warning` |
| **blue** | `#0485F7` = `oklch(62.04% 0.195 253.83)` | 500 | Arc `info` 扩展 token（ADR 003 §决策三）|
| **neutral** | 端点 `snow` ↔ `eclipse`（H=285.89 微冷）| 散落 | HeroUI `background` / `surface` / `muted` / `border` / `separator` 等 |

**单值常量**（不进色阶）：
- `--color-white: oklch(100% 0 0)`
- `--color-black: oklch(0% 0 0)`
- `--color-snow: oklch(99.11% 0 0)`
- `--color-eclipse: oklch(21.03% 0.0059 285.89)`

每个 palette 11 个 stop：`50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900 / 950`（Tailwind v4 标准）。

### 决策二：色阶生成算法（OKLCH 派生）

**Lightness (L)** 沿 Tailwind v4 感知线性分布：
```
50: 98%, 100: 96%, 200: 92%, 300: 86%, 400: 78%,
500: 68%, 600: 58%, 700: 46%, 800: 36%, 900: 24%, 950: 16%
```

**Chroma (C)** 按"钟形衰减"曲线，anchor 附近最高，向 50 / 950 两端衰减：
```
50: 0.18×, 100: 0.34×, 200: 0.62×, 300: 0.92×, 400: 1.00×,
500: 0.95×, 600: 0.85×, 700: 0.70×, 800: 0.55×, 900: 0.38×, 950: 0.24×
（× anchor 的 C 值）
```

**Hue (H)** 保持 anchor 不变。

**Anchor 例外**：anchor 落点的 stop 直接用 anchor 原值（不走 L/C profile），保证 design.md 的 #50FF6C 在色阶里精确还原为 brand-300。

### 决策三：实施位置

#### 3.1 色阶定义 → `apps/mobile/global.css` 的 `@theme` 块

```css
@theme {
  /* Brand (Trace Green) */
  --color-brand-50: oklch(98.00% 0.043 145.76);
  /* ... 11 stops ... */
  --color-brand-300: oklch(88.15% 0.237 145.76);  /* ← anchor */
  /* ... */

  /* Green / Red / Orange / Blue / Neutral 同模式 */

  /* Primitive constants */
  --color-white: oklch(100% 0 0);
  --color-black: oklch(0% 0 0);
  --color-snow: oklch(99.11% 0 0);
  --color-eclipse: oklch(21.03% 0.0059 285.89);
}
```

Tailwind v4 的 `@theme` 自动生成所有 `bg-X-N` / `text-X-N` / `border-X-N` utility，但**业务代码绝不直接使用**（见决策五）。

#### 3.2 Foundation 引用 → `apps/mobile/global.css` 的 `@layer theme` 覆写块

```css
@layer theme {
  :root {
    @variant light {
      --accent: var(--color-brand-300);
      --success: var(--color-green-500);
      --danger: var(--color-red-500);
      --warning: var(--color-orange-400);
      --background: var(--color-neutral-50);
      --surface: var(--color-white);
      /* ... 所有 Foundation token 都 var(--color-XXX-NNN) ... */
    }
    @variant dark {
      --background: var(--color-neutral-950);
      --surface: var(--color-neutral-900);
      /* ... light/dark 同 palette 不同 stop ... */
    }
  }
}
```

#### 3.3 色阶生成脚本 → `tools/generate-color-scales.mjs`

- 单入口，无 build 集成，按需手动跑（`node tools/generate-color-scales.mjs`）
- 输出可直接粘贴到 `global.css` 的 `@theme` 块
- 用 `culori` (Uniwind 间接依赖，无新增 npm 包负担) 做 OKLCH ↔ hex 转换
- anchor / L profile / C profile 都在脚本顶部声明，调整后重新跑即可

### 决策四：Brand 命名 = "Trace Green"

候选过 5 个名字（Neo Green / Aurora / Trace / Alpha / Pulse），选 **Trace** 理由：
- 与产品名 Arc（循迹）双关
- 中性、可商标
- 不与现有大品牌冲突
- 长期沿用 / 商业化都合适

如未来需改名（如转 Alpha 走金融定位），改两处即可：
- `tools/generate-color-scales.mjs` 注释里 palette 描述
- `apps/mobile/global.css` `@theme` 块的 `/* Brand (Trace Green) */` 注释
- Tailwind utility 名 `bg-brand-*` 不变（color value 不动 → 业务代码零改动）

### 决策五：跳级规则更新（v3.1 强化）

```
Component → Foundation | Business → Primitive 色阶 → Primitive 常量
   ✗ 跳 Primitive 色阶（业务代码绝不用 bg-brand-300）
   ✗ 跳 Primitive 常量（业务代码绝不用 bg-white）
```

**唯一例外**：
1. **规则 B**（v3 原有）：Component 内部"中性灰阶 / 透明度"可直接 OKLCH 值或 Primitive
2. **新例外**：HeroUI 自带的 `chart-1` ~ `chart-5` 已经是 Primitive 色阶派生（OKLCH formula），图表场景可直接消费这 5 个 token

业务代码看到的永远是：
- HeroUI Foundation 名：`bg-surface` / `text-foreground` / `bg-accent` 等
- Arc Business 名：`text-gain` / `bg-loss-soft` 等
- Chart 系列：`bg-chart-1` ~ `bg-chart-5`（图表唯一例外）

绝不看到：`bg-brand-300` / `text-neutral-500` / `bg-white` 等色阶或 Primitive 直接消费。

### 决策六：Light / Dark mode 取自同一色阶

design.md 中 Light / Dark mode 是平行命名，但实际**HeroUI 的 status 色在两端取相同 hex**（`#50FF6C` / `#64C33A` 等），仅 `background` / `surface` 系列取不同值。

v3.1 通过同一套色阶 + 不同 stop 实现：

| Light | Dark |
|:---|:---|
| `--background: var(--color-neutral-50)` | `--background: var(--color-neutral-950)` |
| `--surface: var(--color-white)` | `--surface: var(--color-neutral-900)` |
| `--muted: var(--color-neutral-500)` | `--muted: var(--color-neutral-400)` |
| `--accent: var(--color-brand-300)` | `--accent: var(--color-brand-300)`（同）|
| `--success: var(--color-green-500)` | `--success: var(--color-green-500)`（同）|

切主题时仅 `@variant light/dark` 内的赋值变，色阶本身不动。

### 决策七：未来色阶调整流程

```
设计需求改变（如 brand 微调成更柔和绿）
        ↓
改 tools/generate-color-scales.mjs 顶部 PALETTES 常量
        ↓
跑 node tools/generate-color-scales.mjs > /tmp/scales.css
        ↓
把输出粘贴到 apps/mobile/global.css 的 @theme 块
        ↓
所有 Foundation / Business / Component 自动跟随（var 引用）
        ↓
pnpm --filter @arc/mobile web 视觉验证
```

**新增 palette**：在脚本 PALETTES 加新条目；可单独新增（不必全套）。

**新增 anchor 落点**：调整脚本 anchorStop 字段，重新跑即可。

---

## 后果

- ✅ 任何 token 调整都能系统性派生，色彩科学方法落地
- ✅ Light / Dark mode 从同一色阶取值，主题切换严谨
- ✅ 业务代码零暴露色阶 / Primitive（消费规则更严）
- ✅ 跨多设计系统迁移（如未来 HeroUI EOL）只需替换 Foundation override 部分
- ✅ design.md 所有 anchor 完美还原（生成器算法保证）
- ⚠️ 多了一个生成脚本要维护；anchor 调整后必须重新跑
- ⚠️ HeroUI 升级若改 Foundation 命名（如 `accent` → `primary`），override 块要跟改
- ⚠️ 业务开发者需了解"色阶在 @theme，Foundation 在 :root，业务消费 Foundation"3 层关系；ADR 003 §附录 A 已有速查表

---

## 验证

| 项 | 标准 |
|:---|:---|
| 脚本输出 anchor 落点 hex | brand-300 = `#50ff6c`✓, green-500 = `#64c33a` ✓, red-500 = `#fd3367` ✓, orange-400 = `#ff9c3e` ✓, blue-500 = `#0485f7` ✓ |
| typecheck | 6/6 pass |
| `expo export --platform web` | 成功，无 CSS warning |
| 浏览器视觉验证 | Light + Dark 双模式 demo 页与 design.md 内嵌色值无可见差异 |
| iOS sim 验证 | Trace Green 主按钮在 iPhone 17 sim 显示正常 |

---

## 参考

- ADR 003 v3.1: `docs/adr/003-design-tokens.md`
- 色阶生成器: `tools/generate-color-scales.mjs`
- HeroUI Pro Theme Builder 原始输出: `docs/archive/design.md.original`
- OKLCH 色彩理论: https://oklch.com / https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- Tailwind v4 `@theme` 文档: https://tailwindcss.com/docs/theme
- culori OKLCH 文档: https://culori.js.org/api/#oklch
