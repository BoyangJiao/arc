# ADR 004 — 用户头像生成方案

- **状态**: 已接受
- **日期**: 2026-05-10
- **作者**: BoyangJiao + Claude
- **相关 ADR**: 002（UI 库选型），IA v2.2 §3.4

---

## 背景

IA v2.2 §3.4 决定 Me 入口使用「基于邮箱 hash 生成的渐变几何图形」（Vercel / Linear 风格），需要确定具体生成方案。

考虑过的选项：
1. HeroUI Native 默认头像（无 hash 输入，所有用户长一样）
2. 自建渐变生成器（自己实现 hash → color 算法）
3. 第三方库（dicebear / boring-avatars / minidenticons 等）

---

## 决策

### 采用 `@dicebear/collection` 的 `gradient` 生成器

**完整方案**：
```ts
// packages/ui/src/avatar/index.ts
import { createAvatar } from '@dicebear/core';
import { gradient } from '@dicebear/collection';

export const generateAvatar = (seed: string, size = 64): string =>
  createAvatar(gradient, { seed, size }).toDataUri();

// 使用：
// <Image source={{ uri: generateAvatar(user.email) }} />
```

| 维度 | 决策 |
|:---|:---|
| 库 | `@dicebear/core` + `@dicebear/collection`（仅安装 collection 中的 `gradient` 子模块，避免全量打包）|
| Generator | `gradient`（纯色渐变椭圆）— **不**用 `shapes`（带几何图形太 playful） |
| Seed 输入 | 用户邮箱（Stage 1）→ 同一邮箱永远生成同一头像（确定性）|
| 输出 | dataURI（base64 PNG / SVG）→ `<Image source={{uri: ...}} />` 直接消费 |
| 默认尺寸 | 64×64 px（Me 全屏页 profile 区可放大到 128）|
| 自定义上传 | Stage 5 才支持（`user.customAvatarUri` 字段优先于 generated 头像）|

### 拒绝的备选方案

| 备选 | 否决理由 |
|:---|:---|
| **HeroUI Native 默认头像** | 所有用户长一样，无个性化，无品牌温度；缺乏"基于邮箱 hash 的确定性生成" |
| **Dicebear `shapes` generator** | 几何形状（三角、圆等）偏 playful，**不适合金融 app**；Arc 是数据严肃工具 |
| **Dicebear `initials` generator** | 字母首字母方块（Linear 风格）— 备选可，但缺乏视觉差异化（每个用户区分度低）|
| **自建渐变生成器** | 6-10h 工时，无差异化收益；dicebear 已经是社区标准 |
| **`boring-avatars`** | 风格类似但 npm 包不再活跃维护（最后更新 2024 年）|
| **Gravatar** | 依赖外部服务；用户必须先在 gravatar.com 注册才能有头像；金融 app 不应依赖第三方头像源 |

---

## 实施清单

| # | 任务 | 时机 | 文件 |
|:--|:---|:---|:---|
| 1 | 安装依赖 `@dicebear/core` + `@dicebear/collection` | Stage 1 实施 Me 全屏页时 | `packages/ui/package.json` |
| 2 | 实现 `generateAvatar(seed)` 工具函数 | 同上 | `packages/ui/src/avatar/index.ts` |
| 3 | 在 `/me` 全屏页使用 | Stage 1 | `apps/mobile/app/me/index.tsx` |
| 4 | 在 `/(tabs)/index` 顶栏左上头像图标使用（小尺寸 32px）| Stage 1 | `apps/mobile/app/(tabs)/_layout.tsx` |
| 5 | Stage 5 支持自定义上传（覆盖 generated 头像）| Stage 5 | `apps/mobile/app/me/profile.tsx` |

---

## 后果

### 优点
- ✅ 每个用户视觉唯一（基于邮箱 hash），符合 IA v2.2 §3.4 要求
- ✅ 零图片资源开销（生成在客户端，不走 CDN / 不走 Supabase Storage）
- ✅ 与 Vercel / Linear 等现代 dev-tool 风格一致，匹配 Arc"严肃数据工具 + 现代感"定位
- ✅ Stage 5 加自定义上传时，已有 fallback 头像，新老用户体验一致

### 警示
- ⚠️ Dicebear v9 体积约 50KB（gradient 子模块单独 < 10KB）— 需配置打包时只 import gradient 不全量
- ⚠️ Generated 头像不能被用户主观控制 → Stage 5 提供自定义上传才能完全满足"个性化"
- ⚠️ Bundle size: 安装时验证 import `gradient` 不会带入其他 collection 资源

---

## 参考

- Dicebear 官方：https://www.dicebear.com/
- Gradient 生成器：https://www.dicebear.com/styles/gradient/
- Vercel 头像方案（设计灵感）：https://vercel.com/design
