/**
 * InsightTierBadge — PRO / PRO+ 视觉徽章（Insights 扩充 spec）。
 *
 * 当前仅视觉标注目标档位，无运行时门控（真实 paywall 延后到 Stage 4 IAP）。
 * "PRO" / "PRO+" 是产品档位标识（品牌术语，跨语言一致），不走 i18n。
 */

import type { ReactNode } from "react";
import { Chip } from "../primitives";

export type InsightTier = "free" | "pro" | "proPlus";

const TIER_LABEL = { pro: "PRO", proPlus: "PRO+" } as const;

export interface InsightTierBadgeProps {
  readonly tier: InsightTier;
}

export function InsightTierBadge({ tier }: InsightTierBadgeProps): ReactNode {
  if (tier === "free") return null;
  return (
    <Chip size="sm" variant="soft" color="default">
      <Chip.Label>{TIER_LABEL[tier]}</Chip.Label>
    </Chip>
  );
}
