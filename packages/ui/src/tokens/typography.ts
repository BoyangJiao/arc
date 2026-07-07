/**
 * Semantic typography — structured specs → Tailwind class strings.
 *
 * Stage 3: encode font/size/weight/color/line-height/tracking in specs;
 * Stage 4: swap `typographySpecs` values or map to CSS variables without touching components.
 *
 * @see packages/ui/DESIGN-TOKENS.md § Typography
 */

export type TypographyFontFamily = "sans";

export type TypographyFontSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export type TypographyFontWeight = "normal" | "medium" | "semibold" | "bold";

/** Foundation text colors only — business gain/loss is layered via `typographyClass(role, extra)`. */
export type TypographyColor = "foreground" | "muted" | "danger" | "white";

export type TypographyLineHeight = "none" | "tight" | "snug" | "normal";

export type TypographyLetterSpacing = "normal" | "wide";

export interface TypographySpec {
  readonly fontFamily?: TypographyFontFamily;
  /** Omit when size is set via `style.fontSize` (e.g. AssetAvatar). */
  readonly fontSize?: TypographyFontSize;
  readonly fontWeight?: TypographyFontWeight;
  readonly color?: TypographyColor;
  readonly lineHeight?: TypographyLineHeight;
  readonly letterSpacing?: TypographyLetterSpacing;
  readonly tabularNums?: boolean;
  readonly uppercase?: boolean;
  readonly align?: "left" | "center" | "right";
}

const FONT_SIZE: Record<TypographyFontSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
};

const FONT_WEIGHT: Record<TypographyFontWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const COLOR: Record<TypographyColor, string> = {
  foreground: "text-foreground",
  muted: "text-muted",
  danger: "text-danger",
  white: "text-white",
};

const LINE_HEIGHT: Record<TypographyLineHeight, string> = {
  none: "leading-none",
  tight: "leading-tight",
  snug: "leading-snug",
  normal: "leading-normal",
};

const LETTER_SPACING: Record<TypographyLetterSpacing, string> = {
  normal: "tracking-normal",
  wide: "tracking-wide",
};

/** Canonical role definitions — single source of truth for Stage 4 tuning. */
export const typographySpecs = {
  /** Hero / summary total (Portfolio Tab). */
  display: {
    fontSize: "4xl",
    fontWeight: "bold",
    color: "foreground",
    lineHeight: "tight",
    tabularNums: true,
  },
  display2xl: {
    fontSize: "2xl",
    fontWeight: "bold",
    color: "foreground",
    lineHeight: "tight",
    tabularNums: true,
  },
  display3xl: {
    fontSize: "3xl",
    fontWeight: "bold",
    color: "foreground",
    lineHeight: "tight",
    tabularNums: true,
  },
  /** Section heading above ListGroup (e.g. 我的持仓). */
  sectionTitle: {
    fontSize: "lg",
    fontWeight: "semibold",
    color: "foreground",
    lineHeight: "snug",
  },
  /** Large card / portfolio name. */
  titleLg: {
    fontSize: "lg",
    fontWeight: "semibold",
    color: "foreground",
    lineHeight: "snug",
  },
  /** Card title, stack header title, rebalance row label. */
  title: {
    fontSize: "base",
    fontWeight: "semibold",
    color: "foreground",
  },
  /** Field / metric labels (总市值). */
  label: {
    fontSize: "sm",
    color: "muted",
  },
  /** Primary row metric (holding value). */
  metric: {
    fontSize: "base",
    fontWeight: "semibold",
    color: "foreground",
    tabularNums: true,
  },
  /** Secondary numeric column (watchlist price). */
  metricSm: {
    fontSize: "sm",
    fontWeight: "medium",
    color: "foreground",
    tabularNums: true,
  },
  /** Default body. */
  body: {
    fontSize: "base",
    color: "foreground",
  },
  /** Secondary inline body. */
  bodySm: {
    fontSize: "sm",
    color: "foreground",
  },
  /** Form row label (allocation % row). */
  bodyMedium: {
    fontSize: "base",
    fontWeight: "medium",
    color: "foreground",
  },
  /** Ticker / symbol in dense rows. */
  symbol: {
    fontSize: "base",
    fontWeight: "semibold",
    color: "foreground",
  },
  /** Row title in bars / lists (deviation label). */
  rowTitle: {
    fontSize: "sm",
    fontWeight: "medium",
    color: "foreground",
  },
  /** Row value — add gain/loss class via `typographyClass`. */
  rowValue: {
    fontSize: "sm",
    fontWeight: "semibold",
    tabularNums: true,
  },
  /** Period / PnL line (hero, scrub) — color from business palette. */
  changeLg: {
    fontSize: "base",
    fontWeight: "semibold",
    tabularNums: true,
  },
  changeMd: {
    fontSize: "base",
    fontWeight: "medium",
    tabularNums: true,
  },
  /** Holding row period delta amount. */
  changeAmount: {
    fontSize: "xs",
    fontWeight: "medium",
    tabularNums: true,
  },
  /** ChangePercentBadge `sm`. */
  badgeSm: {
    fontSize: "xs",
    fontWeight: "medium",
    tabularNums: true,
  },
  /** ChangePercentBadge `md`. */
  badgeMd: {
    fontSize: "sm",
    fontWeight: "medium",
    tabularNums: true,
  },
  /** Outline insight card title (e.g. daily snapshot — accent tint per ADR 008). */
  snapshotCardTitle: {
    fontSize: "sm",
    fontWeight: "medium",
    lineHeight: "snug",
  },
  /** Captions, tertiary lines, hints. */
  caption: {
    fontSize: "xs",
    color: "muted",
  },
  /** Donut / allocation segment label. */
  captionForeground: {
    fontSize: "xs",
    color: "foreground",
  },
  /** Compact emphasis caption (mover symbol). */
  captionMedium: {
    fontSize: "xs",
    fontWeight: "medium",
    color: "foreground",
  },
  /** Toggle / segment control label. */
  controlLabel: {
    fontSize: "xs",
    fontWeight: "medium",
  },
  /** Section overline (HOLDINGS). */
  overline: {
    fontSize: "xs",
    fontWeight: "medium",
    color: "muted",
    letterSpacing: "wide",
    uppercase: true,
  },
  /** Empty / loading helper (centered block). */
  emptyMessage: {
    fontSize: "sm",
    color: "muted",
    align: "center",
  },
  /** Inline disclaimer footnote. */
  disclaimer: {
    fontSize: "xs",
    color: "muted",
  },
  /** Form field label above input. */
  fieldLabel: {
    fontSize: "xs",
    color: "muted",
  },
  /** Validation / error line. */
  danger: {
    fontSize: "xs",
    color: "danger",
  },
  dangerSm: {
    fontSize: "sm",
    color: "danger",
  },
  /** Avatar monogram on gradient (size via `style.fontSize`). */
  avatarMonogram: {
    fontWeight: "semibold",
    color: "white",
  },
  /** Avatar market badge (size via `style.fontSize`). */
  avatarBadge: {
    fontWeight: "medium",
    color: "muted",
  },
  /** Status chip on muted surface (新建仓). */
  chipStatus: {
    fontSize: "xs",
    color: "muted",
  },
} as const satisfies Record<string, TypographySpec>;

export type TypographyRole = keyof typeof typographySpecs;

export function typographySpecToClassName(spec: TypographySpec): string {
  const parts: string[] = [];
  if (spec.fontSize) parts.push(FONT_SIZE[spec.fontSize]);

  if (spec.fontWeight) parts.push(FONT_WEIGHT[spec.fontWeight]);
  if (spec.color) parts.push(COLOR[spec.color]);
  if (spec.lineHeight) parts.push(LINE_HEIGHT[spec.lineHeight]);
  if (spec.letterSpacing) parts.push(LETTER_SPACING[spec.letterSpacing]);
  if (spec.tabularNums) parts.push("tabular-nums");
  if (spec.uppercase) parts.push("uppercase");
  if (spec.align === "center") parts.push("text-center");
  if (spec.align === "right") parts.push("text-right");

  return parts.join(" ");
}

/** Pre-built class strings per role. */
export const typography = Object.fromEntries(
  (Object.entries(typographySpecs) as [TypographyRole, TypographySpec][]).map(([role, spec]) => [
    role,
    typographySpecToClassName(spec),
  ])
) as { readonly [K in TypographyRole]: string };

/** Combine a typography role with extra classes (e.g. business gain/loss). */
export function typographyClass(role: TypographyRole, ...extra: readonly string[]): string {
  return [typography[role], ...extra].filter(Boolean).join(" ");
}

// ── Named exports (stable imports for components) ─────────────────────────

export const TYPO_DISPLAY = typography.display;
export const TYPO_DISPLAY_2XL = typography.display2xl;
export const TYPO_DISPLAY_3XL = typography.display3xl;
export const TYPO_SECTION_TITLE = typography.sectionTitle;
export const TYPO_TITLE_LG = typography.titleLg;
export const TYPO_TITLE = typography.title;
export const TYPO_LABEL = typography.label;
export const TYPO_METRIC = typography.metric;
export const TYPO_METRIC_SM = typography.metricSm;
export const TYPO_BODY = typography.body;
export const TYPO_BODY_SM = typography.bodySm;
export const TYPO_BODY_MEDIUM = typography.bodyMedium;
export const TYPO_SYMBOL = typography.symbol;
export const TYPO_ROW_TITLE = typography.rowTitle;
export const TYPO_ROW_VALUE = typography.rowValue;
export const TYPO_CHANGE_LG = typography.changeLg;
export const TYPO_CHANGE_MD = typography.changeMd;
export const TYPO_CHANGE_AMOUNT = typography.changeAmount;
export const TYPO_BADGE_SM = typography.badgeSm;
export const TYPO_BADGE_MD = typography.badgeMd;
/** Snapshot / insight card title — pair with `text-accent-soft-foreground`. */
export const TYPO_SNAPSHOT_CARD_TITLE = `${typography.snapshotCardTitle} text-accent-soft-foreground`;
export const TYPO_CAPTION = typography.caption;
export const TYPO_CAPTION_FOREGROUND = typography.captionForeground;
export const TYPO_CAPTION_MEDIUM = typography.captionMedium;
export const TYPO_CONTROL_LABEL = typography.controlLabel;
export const TYPO_OVERLINE = typography.overline;
export const TYPO_EMPTY_MESSAGE = typography.emptyMessage;
export const TYPO_DISCLAIMER = typography.disclaimer;
export const TYPO_FIELD_LABEL = typography.fieldLabel;
export const TYPO_DANGER = typography.danger;
export const TYPO_DANGER_SM = typography.dangerSm;
export const TYPO_AVATAR_MONOGRAM = typography.avatarMonogram;
export const TYPO_AVATAR_BADGE = typography.avatarBadge;
export const TYPO_CHIP_STATUS = typography.chipStatus;
