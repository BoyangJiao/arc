// @arc/ui — UI 基建层（接口层，对外 flat namespace）
// 见 CLAUDE.md §五（薄封装铁律）与 ADR 006（分层架构）。
//
// 8 个子目录的归位由 ADR 006 §决策二 + §决策三定义：
//   tokens          (一直自有)
//   primitives      (HeroUI OSS re-export)
//   primitives-pro  (HeroUI Pro re-export — license 受限)
//   wrappers        (其他第三方包：lucide / dicebear / safe-area)
//   navigation      (自建：FloatingTabBar / Header Atoms)
//   finance         (自建领域组件 — Stage 2+ 开始填充)
//   charts          (自建图表 — Stage 2+ 开始填充)
//   avatar          (自建：UserAvatar — ADR 004 落地)

export * from "./tokens";
export * from "./primitives";
export * from "./primitives-pro";
export * from "./wrappers";
export * from "./navigation";
export * from "./finance";
export * from "./charts";
export * from "./avatar";
