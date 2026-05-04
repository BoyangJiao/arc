# CLAUDE.md - 项目规范与指令

## 项目概览
- **名称**: Arc (暂定)
- **定位**: 全球资产配置追踪器 & 再平衡助手
- **目标用户**: 25-40 岁高净值人群 (Gen-Z & Millennials)
- **风格**: 科技、简约、高端 (借鉴 Delta)

## 文案铁律 (必须遵守)
1. **禁止建议**: 永不出现 "建议买入/卖出"、"你应该..." 等措辞。
2. **描述性表达**: 使用 "达到目标配置需要的份额变化为 X" 或 "偏离目标配置 Y%"。
3. **免责标识**: 任何资产现值、净值展示均需配以 "仅供参考，可能延迟" 的标识。
4. **色彩方案**: 支持红涨绿跌/绿涨红跌切换，代码实现需引用 `tokens` 中的语义色。

## 工程规约
- **技术栈**: Expo / TypeScript / NativeWind / Supabase / Drizzle / decimal.js.
- **金额处理**: 严禁使用 `number`！必须使用 `decimal.js` 处理所有财务计算以防火浮点误差。
- **数据源**: 必须通过 `packages/data-sources/` 的 Adapter 层抽象，不准在业务代码直接调用具体厂商 API。
- **i18n**: 双语 Day1，所有文案严禁硬编码在组件内。

## 开发模式
- **Monorepo**: 使用 pnpm workspaces + Turborepo.
- **文档优先**: 关键决策必须记录在 `docs/adr/`.
- **常用命令**:
  - 安装依赖: `pnpm install`
  - 启动开发: `pnpm dev`
  - 数据库同步: `pnpm db:push`
