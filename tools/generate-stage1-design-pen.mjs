#!/usr/bin/env node
/**
 * One-shot generator: Stage 1 screens + @arc/ui component library for Pencil.
 * Run: node tools/generate-stage1-design-pen.mjs
 * Output: docs/design/Arc stage1 design.pen
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../docs/design/Arc stage1 design.pen");

const W = 390;
const H = 844;
const GAP = 56;
const COLS = 4;

let _id = 0;
const id = (prefix) => `${prefix}${(++_id).toString(36)}`;

const doc = {
  version: "2.11",
  themes: { mode: ["light", "dark"] },
  variables: {
    "foundation.background": {
      type: "color",
      value: [
        { value: "#F8F8F9", theme: { mode: "light" } },
        { value: "#0D0D0E", theme: { mode: "dark" } },
      ],
    },
    "foundation.foreground": {
      type: "color",
      value: [
        { value: "#18181B", theme: { mode: "light" } },
        { value: "#FCFCFC", theme: { mode: "dark" } },
      ],
    },
    "foundation.surface": {
      type: "color",
      value: [
        { value: "#FFFFFF", theme: { mode: "light" } },
        { value: "#1F1F20", theme: { mode: "dark" } },
      ],
    },
    "foundation.muted": {
      type: "color",
      value: [
        { value: "#98989B", theme: { mode: "light" } },
        { value: "#B7B7BA", theme: { mode: "dark" } },
      ],
    },
    "foundation.accent": {
      type: "color",
      value: "#50FF6C",
    },
    "foundation.accent-foreground": {
      type: "color",
      value: "#18181B",
    },
    "foundation.danger": {
      type: "color",
      value: "#FD3367",
    },
    "foundation.success": {
      type: "color",
      value: "#64C33A",
    },
    "foundation.border": {
      type: "color",
      value: [
        { value: "#D0D0D4", theme: { mode: "light" } },
        { value: "#58585A", theme: { mode: "dark" } },
      ],
    },
    "foundation.field-background": {
      type: "color",
      value: [
        { value: "#FFFFFF", theme: { mode: "light" } },
        { value: "#1F1F20", theme: { mode: "dark" } },
      ],
    },
    "foundation.field-border": {
      type: "color",
      value: "$foundation.border",
    },
    "business.gain": {
      type: "color",
      value: "$foundation.success",
    },
    "business.loss": {
      type: "color",
      value: "$foundation.danger",
    },
    "spacing.screen": { type: "number", value: 24 },
    "spacing.card": { type: "number", value: 16 },
    "radius.card": { type: "number", value: 12 },
    "radius.button": { type: "number", value: 10 },
    "radius.avatar": { type: "number", value: 9999 },
    "typography.title": { type: "number", value: 30 },
    "typography.heading": { type: "number", value: 20 },
    "typography.body": { type: "number", value: 16 },
    "typography.caption": { type: "number", value: 12 },
    "typography.value-xl": { type: "number", value: 36 },
  },
  children: [],
};

function text(props) {
  return {
    type: "text",
    textGrowth: "auto",
    fontFamily: "Inter",
    ...props,
  };
}

function frame(props, children = []) {
  return { type: "frame", layout: "vertical", ...props, children };
}

function screenShell(screenId, screenName, route, children, { withTabBar = true } = {}) {
  const contentHeight = withTabBar ? H - 88 : H;
  const shellChildren = [
    frame(
      {
        id: id("scr"),
        name: "Content",
        x: 0,
        y: 0,
        width: W,
        height: contentHeight,
        layout: "vertical",
        padding: "$spacing.screen",
        gap: 16,
      },
      children
    ),
  ];
  if (withTabBar) {
    shellChildren.push({
      id: id("tab"),
      name: "@arc/ui/FloatingTabBar",
      type: "ref",
      ref: "compFloatingTabBar",
      x: 24,
      y: H - 72,
    });
  }
  return frame(
    {
      id: screenId,
      name: screenName,
      context: route,
      x: 0,
      y: 0,
      width: W,
      height: H,
      fill: "$foundation.background",
      clip: true,
      layout: "none",
    },
    shellChildren
  );
}

// ── Reusable components (code-mapped) ─────────────────────────────────────

const components = [
  frame(
    {
      id: "compTextMuted",
      name: "@arc/ui/Text — muted",
      reusable: true,
      context: "packages/ui/src/primitives/Text.tsx",
      width: 200,
      height: 20,
    },
    [
      text({
        id: "compTextMutedLabel",
        content: "Muted label",
        fill: "$foundation.muted",
        fontSize: "$typography.caption",
      }),
    ]
  ),
  frame(
    {
      id: "compTextForeground",
      name: "@arc/ui/Text — foreground",
      reusable: true,
      context: "packages/ui/src/primitives/Text.tsx",
      width: 200,
      height: 24,
    },
    [
      text({
        id: "compTextFgLabel",
        content: "Foreground text",
        fill: "$foundation.foreground",
        fontSize: "$typography.body",
        fontWeight: "600",
      }),
    ]
  ),
  frame(
    {
      id: "compButtonPrimary",
      name: "@arc/ui/Button — primary",
      reusable: true,
      context: "packages/ui/src/primitives/index.ts → heroui-native Button",
      width: 320,
      height: 48,
      fill: "$foundation.accent",
      cornerRadius: "$radius.button",
      layout: "horizontal",
      justifyContent: "center",
      alignItems: "center",
    },
    [
      text({
        id: "compBtnPrimaryLabel",
        content: "Button",
        fill: "$foundation.accent-foreground",
        fontSize: "$typography.body",
        fontWeight: "600",
      }),
    ]
  ),
  frame(
    {
      id: "compButtonGhost",
      name: "@arc/ui/Button — ghost",
      reusable: true,
      context: "packages/ui/src/primitives/index.ts → heroui-native Button",
      width: 320,
      height: 48,
      cornerRadius: "$radius.button",
      layout: "horizontal",
      justifyContent: "center",
      alignItems: "center",
    },
    [
      text({
        id: "compBtnGhostLabel",
        content: "Ghost",
        fill: "$foundation.foreground",
        fontSize: "$typography.body",
      }),
    ]
  ),
  frame(
    {
      id: "compCard",
      name: "@arc/ui/Card",
      reusable: true,
      context: "packages/ui/src/primitives/index.ts → heroui-native Card",
      width: 320,
      fill: "$foundation.surface",
      cornerRadius: "$radius.card",
      stroke: { thickness: 1, fill: "$foundation.border" },
      layout: "vertical",
      padding: "$spacing.card",
      slot: ["compButtonPrimary"],
    },
    [
      text({
        id: "compCardSlot",
        content: "Card content slot",
        fill: "$foundation.muted",
        fontSize: "$typography.caption",
      }),
    ]
  ),
  frame(
    {
      id: "compUserAvatar",
      name: "@arc/ui/UserAvatar",
      reusable: true,
      context: "packages/ui/src/avatar/UserAvatar.tsx",
      width: 40,
      height: 40,
      cornerRadius: "$radius.avatar",
      fill: {
        type: "gradient",
        gradientType: "linear",
        rotation: 135,
        colors: [
          { color: "#50FF6C", position: 0 },
          { color: "#0485F7", position: 1 },
        ],
      },
    },
    []
  ),
  frame(
    {
      id: "compFloatingTabBar",
      name: "@arc/ui/FloatingTabBar",
      reusable: true,
      context: "packages/ui/src/navigation/FloatingTabBar.tsx",
      width: 342,
      height: 56,
      fill: "$foundation.surface",
      cornerRadius: 28,
      stroke: { thickness: 1, fill: "$foundation.border" },
      layout: "horizontal",
      justifyContent: "space_between",
      alignItems: "center",
      padding: [8, 20, 8, 20],
    },
    [
      text({
        id: "compTabPortfolio",
        content: "Portfolio",
        fill: "$foundation.accent",
        fontSize: 11,
        fontWeight: "600",
      }),
      text({
        id: "compTabMarkets",
        content: "Markets",
        fill: "$foundation.muted",
        fontSize: 11,
      }),
      text({
        id: "compTabInsights",
        content: "Insights",
        fill: "$foundation.muted",
        fontSize: 11,
      }),
    ]
  ),
  frame(
    {
      id: "compEmptyState",
      name: "@arc/ui/EmptyState",
      reusable: true,
      context: "packages/ui/src/primitives-pro → heroui-native-pro/empty-state",
      width: 300,
      height: 200,
      layout: "vertical",
      alignItems: "center",
      gap: 12,
    },
    [
      {
        id: "compEmptyIcon",
        type: "icon_font",
        iconFontFamily: "lucide",
        iconFontName: "trending-up",
        width: 28,
        height: 28,
        fill: "$foundation.muted",
      },
      text({
        id: "compEmptyTitle",
        content: "Title",
        fill: "$foundation.foreground",
        fontSize: "$typography.heading",
        fontWeight: "600",
      }),
      text({
        id: "compEmptyDesc",
        content: "Description",
        fill: "$foundation.muted",
        fontSize: "$typography.body",
        textAlign: "center",
        textGrowth: "fixed-width",
        width: 260,
      }),
    ]
  ),
  frame(
    {
      id: "compSettingsRow",
      name: "Settings row",
      reusable: true,
      context: "apps/mobile/app/me/settings.tsx pattern",
      width: 342,
      height: 56,
      fill: "$foundation.surface",
      cornerRadius: "$radius.card",
      layout: "horizontal",
      justifyContent: "space_between",
      alignItems: "center",
      padding: [16, 16, 16, 16],
    },
    [
      text({
        id: "compSettingsLabel",
        content: "Label",
        fill: "$foundation.foreground",
        fontSize: "$typography.body",
      }),
      text({
        id: "compSettingsValue",
        content: "Value",
        fill: "$foundation.accent",
        fontSize: "$typography.body",
        fontWeight: "600",
      }),
    ]
  ),
  frame(
    {
      id: "compTextField",
      name: "@arc/ui/TextField",
      reusable: true,
      context: "packages/ui/src/primitives/index.ts → TextField/Input",
      width: 320,
      layout: "vertical",
      gap: 6,
    },
    [
      text({
        id: "compTfLabel",
        content: "Label",
        fill: "$foundation.foreground",
        fontSize: "$typography.body",
      }),
      frame(
        {
          id: "compTfInput",
          width: "fill_container",
          height: 44,
          fill: "$foundation.field-background",
          cornerRadius: 8,
          stroke: { thickness: 1, fill: "$foundation.field-border" },
          padding: [12, 12, 12, 12],
          layout: "horizontal",
          alignItems: "center",
        },
        [
          text({
            id: "compTfPlaceholder",
            content: "Placeholder",
            fill: "$foundation.muted",
            fontSize: "$typography.body",
          }),
        ]
      ),
    ]
  ),
];

// Component library canvas (left of screens)
const componentLibrary = frame(
  {
    id: "libComponents",
    name: "📦 @arc/ui Components",
    x: -1400,
    y: 0,
    width: 1280,
    layout: "vertical",
    gap: 24,
    padding: 32,
    fill: "#F1F2F3",
    cornerRadius: 16,
  },
  [
    text({
      id: id("lbl"),
      content: "Reusable components — names match @arc/ui exports",
      fill: "#58585A",
      fontSize: 14,
      fontWeight: "600",
    }),
    frame(
      {
        id: id("grid"),
        layout: "horizontal",
        gap: 24,
        width: "fill_container",
      },
      components.map((c, i) => ({
        ...c,
        x: undefined,
        y: undefined,
        layoutPosition: "auto",
      }))
    ),
  ]
);

doc.children.push(componentLibrary);

function placeScreen(index, label, screenFrame) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = col * (W + GAP);
  const y = row * (H + GAP + 40);

  doc.children.push(
    frame(
      {
        id: id("grp"),
        name: label,
        x,
        y,
        layout: "vertical",
        gap: 8,
        width: W,
      },
      [
        text({
          id: id("cap"),
          content: label,
          fill: "#58585A",
          fontSize: 13,
          fontWeight: "600",
        }),
        { ...screenFrame, x: 0, y: 0 },
      ]
    )
  );
}

// ── Screens ─────────────────────────────────────────────────────────────────

function signInStart() {
  return screenShell(id("s"), "J1 · 登录 — 邮箱", "/sign-in", [
    text({
      id: id("t"),
      content: "欢迎使用 Arc",
      fill: "$foundation.foreground",
      fontSize: "$typography.title",
      fontWeight: "600",
    }),
    text({
      id: id("t"),
      content: "循迹 — 全球资产配置追踪",
      fill: "$foundation.muted",
      fontSize: "$typography.body",
    }),
    {
      id: id("c"),
      type: "ref",
      ref: "compCard",
      width: "fill_container",
      descendants: {
        "compCardSlot": { content: "" },
        "compBtnPrimaryLabel": undefined,
      },
      children: [
        text({
          id: id("t"),
          content: "邮箱",
          fill: "$foundation.foreground",
          fontSize: "$typography.body",
        }),
        frame(
          {
            id: id("f"),
            width: "fill_container",
            height: 44,
            fill: "$foundation.field-background",
            cornerRadius: 8,
            stroke: { thickness: 1, fill: "$foundation.field-border" },
            padding: 12,
          },
          [
            text({
              id: id("t"),
              content: "you@example.com",
              fill: "$foundation.muted",
              fontSize: "$typography.body",
            }),
          ]
        ),
        {
          id: id("b"),
          type: "ref",
          ref: "compButtonPrimary",
          width: "fill_container",
          descendants: { "compBtnPrimaryLabel": { content: "发送验证码" } },
        },
        {
          id: id("b"),
          type: "ref",
          ref: "compButtonGhost",
          width: "fill_container",
          descendants: { "compBtnGhostLabel": { content: "发送登录链接" } },
        },
      ],
    },
    text({
      id: id("t"),
      content: "本工具不构成投资建议",
      fill: "$foundation.muted",
      fontSize: "$typography.caption",
      textAlign: "center",
      textGrowth: "fixed-width",
      width: W - 48,
    }),
  ], { withTabBar: false });
}

function signInCode() {
  return screenShell(id("s"), "J1 · 登录 — 验证码", "/sign-in (awaitingCode)", [
    {
      id: id("c"),
      type: "ref",
      ref: "compCard",
      width: "fill_container",
      children: [
        text({
          id: id("t"),
          content: "请输入验证码",
          fill: "$foundation.foreground",
          fontSize: "$typography.heading",
          fontWeight: "600",
        }),
        text({
          id: id("t"),
          content: "已发送至 you@example.com",
          fill: "$foundation.muted",
          fontSize: "$typography.caption",
        }),
        frame(
          {
            id: id("f"),
            width: "fill_container",
            height: 48,
            fill: "$foundation.field-background",
            cornerRadius: 8,
            stroke: { thickness: 1, fill: "$foundation.field-border" },
            layout: "horizontal",
            justifyContent: "center",
            alignItems: "center",
          },
          [
            text({
              id: id("t"),
              content: "• • • • • • • •",
              fill: "$foundation.foreground",
              fontSize: 24,
              letterSpacing: 4,
            }),
          ]
        ),
        {
          id: id("b"),
          type: "ref",
          ref: "compButtonPrimary",
          width: "fill_container",
          descendants: { "compBtnPrimaryLabel": { content: "验证并登录" } },
        },
        {
          id: id("b"),
          type: "ref",
          ref: "compButtonGhost",
          width: "fill_container",
          descendants: { "compBtnGhostLabel": { content: "重新发送" } },
        },
      ],
    },
  ], { withTabBar: false });
}

function portfolioTab() {
  return screenShell(id("s"), "Portfolio Tab", "/(tabs)/index", [
    frame(
      {
        id: id("top"),
        layout: "horizontal",
        justifyContent: "space_between",
        width: "fill_container",
        alignItems: "center",
      },
      [
        { id: id("av"), type: "ref", ref: "compUserAvatar" },
        { id: id("sp"), type: "frame", width: 40, height: 40 },
      ]
    ),
    frame(
      {
        id: id("val"),
        layout: "vertical",
        gap: 4,
        width: "fill_container",
      },
      [
        text({
          id: id("t"),
          content: "总资产",
          fill: "$foundation.muted",
          fontSize: "$typography.caption",
        }),
        text({
          id: id("t"),
          content: "¥12,960.00",
          fill: "$foundation.foreground",
          fontSize: "$typography.value-xl",
          fontWeight: "700",
        }),
        text({
          id: id("t"),
          content: "仅供参考，可能延迟",
          fill: "$foundation.muted",
          fontSize: "$typography.caption",
        }),
      ]
    ),
    {
      id: id("pc"),
      type: "ref",
      ref: "compCard",
      width: "fill_container",
      descendants: {
        "compCardSlot": { content: "" },
      },
      children: [
        frame(
          {
            id: id("row"),
            layout: "horizontal",
            justifyContent: "space_between",
            width: "fill_container",
          },
          [
            frame(
              { id: id("l"), layout: "vertical", gap: 4 },
              [
                text({
                  id: id("t"),
                  content: "My Portfolio",
                  fill: "$foundation.foreground",
                  fontSize: "$typography.heading",
                  fontWeight: "600",
                }),
                text({
                  id: id("t"),
                  content: "1 只持仓",
                  fill: "$foundation.muted",
                  fontSize: "$typography.caption",
                }),
              ]
            ),
            text({
              id: id("t"),
              content: "¥12,960.00",
              fill: "$foundation.foreground",
              fontSize: "$typography.body",
              fontWeight: "600",
            }),
          ]
        ),
      ],
    },
    text({
      id: id("t"),
      content: "本工具不构成投资建议",
      fill: "$foundation.muted",
      fontSize: "$typography.caption",
      textAlign: "center",
      textGrowth: "fixed-width",
      width: W - 48,
    }),
  ]);
}

function portfolioDetail() {
  const s = screenShell(id("s"), "Portfolio Detail", "/portfolio/[id]", []);
  // Replace content — add nav header + holdings
  const content = s.children[0];
  content.children = [
    frame(
      {
        id: id("hdr"),
        layout: "horizontal",
        alignItems: "center",
        gap: 8,
        width: "fill_container",
      },
      [
        {
          id: id("ic"),
          type: "icon_font",
          iconFontFamily: "lucide",
          iconFontName: "chevron-left",
          width: 20,
          height: 20,
          fill: "$foundation.foreground",
        },
        text({
          id: id("t"),
          content: "My Portfolio",
          fill: "$foundation.foreground",
          fontSize: "$typography.heading",
          fontWeight: "600",
        }),
      ]
    ),
    frame(
      { id: id("val"), layout: "vertical", gap: 4, width: "fill_container" },
      [
        text({
          id: id("t"),
          content: "总市值",
          fill: "$foundation.muted",
          fontSize: "$typography.caption",
        }),
        text({
          id: id("t"),
          content: "¥12,960.00",
          fill: "$foundation.foreground",
          fontSize: 30,
          fontWeight: "700",
        }),
        text({
          id: id("t"),
          content: "仅供参考，可能延迟",
          fill: "$foundation.muted",
          fontSize: "$typography.caption",
        }),
      ]
    ),
    frame(
      {
        id: id("th"),
        layout: "horizontal",
        width: "fill_container",
        padding: [0, 8, 8, 8],
      },
      [
        text({
          id: id("t"),
          content: "资产",
          fill: "$foundation.muted",
          fontSize: 10,
          width: 80,
        }),
        text({
          id: id("t"),
          content: "数量",
          fill: "$foundation.muted",
          fontSize: 10,
          textAlign: "right",
          width: 50,
        }),
        text({
          id: id("t"),
          content: "单价",
          fill: "$foundation.muted",
          fontSize: 10,
          textAlign: "right",
          width: 70,
        }),
        text({
          id: id("t"),
          content: "市值",
          fill: "$foundation.muted",
          fontSize: 10,
          textAlign: "right",
          width: 80,
        }),
      ]
    ),
    {
      id: id("row"),
      type: "ref",
      ref: "compCard",
      width: "fill_container",
      children: [
        frame(
          {
            id: id("r"),
            layout: "horizontal",
            width: "fill_container",
            alignItems: "center",
          },
          [
            frame(
              { id: id("l"), layout: "vertical", gap: 2, width: 80 },
              [
                text({
                  id: id("t"),
                  content: "AAPL",
                  fill: "$foundation.foreground",
                  fontWeight: "600",
                }),
                text({
                  id: id("t"),
                  content: "USD",
                  fill: "$foundation.muted",
                  fontSize: 10,
                }),
              ]
            ),
            text({
              id: id("t"),
              content: "10.00",
              fill: "$foundation.foreground",
              fontSize: 13,
              textAlign: "right",
              width: 50,
            }),
            text({
              id: id("t"),
              content: "180.00",
              fill: "$foundation.muted",
              fontSize: 13,
              textAlign: "right",
              width: 70,
            }),
            text({
              id: id("t"),
              content: "¥12,960",
              fill: "$foundation.foreground",
              fontSize: 13,
              fontWeight: "600",
              textAlign: "right",
              width: 80,
            }),
          ]
        ),
      ],
    },
    {
      id: id("add"),
      type: "ref",
      ref: "compButtonPrimary",
      width: "fill_container",
      descendants: { "compBtnPrimaryLabel": { content: "添加交易" } },
    },
    text({
      id: id("t"),
      content: "本工具不构成投资建议",
      fill: "$foundation.muted",
      fontSize: "$typography.caption",
      textAlign: "center",
      textGrowth: "fixed-width",
      width: W - 48,
    }),
  ];
  // No tab bar on stack screens
  s.children = [content];
  return s;
}

function addTransaction() {
  const s = frame(
    {
      id: id("s"),
      name: "Add Transaction",
      context: "/portfolio/[id]/transactions/new",
      width: W,
      height: H,
      fill: "$foundation.background",
      clip: true,
      layout: "vertical",
      padding: "$spacing.screen",
      gap: 16,
    },
    [
      frame(
        {
          id: id("hdr"),
          layout: "horizontal",
          justifyContent: "space_between",
          width: "fill_container",
        },
        [
          text({
            id: id("t"),
            content: "添加交易",
            fill: "$foundation.foreground",
            fontSize: "$typography.heading",
            fontWeight: "600",
          }),
          {
            id: id("x"),
            type: "icon_font",
            iconFontFamily: "lucide",
            iconFontName: "x",
            width: 22,
            height: 22,
            fill: "$foundation.muted",
          },
        ]
      ),
      {
        id: id("sym"),
        type: "ref",
        ref: "compTextField",
        width: "fill_container",
        descendants: {
          "compTfLabel": { content: "标的代码" },
          "compTfPlaceholder": { content: "AAPL" },
        },
      },
      {
        id: id("sh"),
        type: "ref",
        ref: "compTextField",
        width: "fill_container",
        descendants: {
          "compTfLabel": { content: "数量" },
          "compTfPlaceholder": { content: "10" },
        },
      },
      {
        id: id("pr"),
        type: "ref",
        ref: "compTextField",
        width: "fill_container",
        descendants: {
          "compTfLabel": { content: "单价 (USD)" },
          "compTfPlaceholder": { content: "180.00" },
        },
      },
      {
        id: id("fee"),
        type: "ref",
        ref: "compTextField",
        width: "fill_container",
        descendants: {
          "compTfLabel": { content: "手续费" },
          "compTfPlaceholder": { content: "0" },
        },
      },
      { id: id("sp"), type: "frame", height: 120, width: 1 },
      {
        id: id("save"),
        type: "ref",
        ref: "compButtonPrimary",
        width: "fill_container",
        descendants: { "compBtnPrimaryLabel": { content: "保存" } },
      },
    ]
  );
  return s;
}

function marketsTab() {
  return screenShell(id("s"), "Markets Tab", "/(tabs)/markets", [
    {
      id: id("es"),
      type: "ref",
      ref: "compEmptyState",
      width: "fill_container",
      height: 400,
      descendants: {
        "compEmptyIcon": { iconFontName: "trending-up" },
        "compEmptyTitle": { content: "行情" },
        "compEmptyDesc": { content: "即将推出" },
      },
    },
  ]);
}

function insightsTab() {
  return screenShell(id("s"), "Insights Tab", "/(tabs)/insights", [
    {
      id: id("es"),
      type: "ref",
      ref: "compEmptyState",
      width: "fill_container",
      height: 400,
      descendants: {
        "compEmptyIcon": { iconFontName: "lightbulb" },
        "compEmptyTitle": { content: "洞察" },
        "compEmptyDesc": { content: "即将推出" },
      },
    },
  ]);
}

function meScreen() {
  const s = frame(
    {
      id: id("s"),
      width: W,
      height: H,
      fill: "$foundation.background",
      clip: true,
      layout: "vertical",
      padding: "$spacing.screen",
      gap: 16,
    },
    [
      frame(
        {
          id: id("hdr"),
          layout: "horizontal",
          alignItems: "center",
          gap: 8,
        },
        [
          {
            id: id("ic"),
            type: "icon_font",
            iconFontFamily: "lucide",
            iconFontName: "chevron-left",
            width: 20,
            height: 20,
            fill: "$foundation.foreground",
          },
          text({
            id: id("t"),
            content: "我的",
            fill: "$foundation.foreground",
            fontSize: "$typography.heading",
            fontWeight: "600",
          }),
        ]
      ),
      frame(
        {
          id: id("prof"),
          layout: "vertical",
          alignItems: "center",
          gap: 12,
          width: "fill_container",
          padding: [24, 0, 24, 0],
        },
        [
          {
            id: id("av"),
            type: "ref",
            ref: "compUserAvatar",
            width: 80,
            height: 80,
          },
          text({
            id: id("t"),
            content: "you@example.com",
            fill: "$foundation.foreground",
            fontSize: "$typography.body",
          }),
        ]
      ),
      {
        id: id("set"),
        type: "ref",
        ref: "compSettingsRow",
        width: "fill_container",
        descendants: {
          "compSettingsLabel": { content: "设置" },
          "compSettingsValue": { content: "" },
        },
        children: [
          {
            id: id("ch"),
            type: "icon_font",
            iconFontFamily: "lucide",
            iconFontName: "chevron-right",
            width: 18,
            height: 18,
            fill: "$foundation.muted",
          },
        ],
      },
      {
        id: id("out"),
        type: "ref",
        ref: "compButtonGhost",
        width: "fill_container",
        descendants: { "compBtnGhostLabel": { content: "退出登录" } },
      },
    ]
  );
  return s;
}

function settingsScreen() {
  const s = frame(
    {
      id: id("s"),
      width: W,
      height: H,
      fill: "$foundation.background",
      clip: true,
      layout: "vertical",
      padding: "$spacing.screen",
      gap: 16,
    },
    [
      frame(
        { id: id("hdr"), layout: "horizontal", alignItems: "center", gap: 8 },
        [
          {
            id: id("ic"),
            type: "icon_font",
            iconFontFamily: "lucide",
            iconFontName: "chevron-left",
            width: 20,
            height: 20,
            fill: "$foundation.foreground",
          },
          text({
            id: id("t"),
            content: "设置",
            fill: "$foundation.foreground",
            fontSize: "$typography.heading",
            fontWeight: "600",
          }),
        ]
      ),
      ...[
        ["报告货币", "CNY ¥"],
        ["语言", "中文"],
        ["涨跌色", "绿涨红跌"],
        ["外观", "浅色"],
        ["行情数据", "Fixture（离线）"],
      ].map(([label, value], i) => ({
        id: id(`sr${i}`),
        type: "ref",
        ref: "compSettingsRow",
        width: "fill_container",
        descendants: {
          "compSettingsLabel": { content: label },
          "compSettingsValue": { content: value },
        },
      })),
    ]
  );
  return s;
}

const screens = [
  ["J1 · /sign-in — 邮箱", signInStart()],
  ["J1 · /sign-in — 验证码", signInCode()],
  ["Portfolio · /(tabs)", portfolioTab()],
  ["Portfolio Detail · /portfolio/[id]", portfolioDetail()],
  ["Add Transaction · modal", addTransaction()],
  ["Markets · /(tabs)/markets", marketsTab()],
  ["Insights · /(tabs)/insights", insightsTab()],
  ["Me · /me", meScreen()],
  ["Settings · /me/settings", settingsScreen()],
];

screens.forEach(([label, screen], i) => placeScreen(i, label, screen));

writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote ${OUT} (${screens.length} screens, ${components.length} components)`);
