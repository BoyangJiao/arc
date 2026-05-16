import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/drizzle/migrations/**",
      "tools/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // ADR 003 v3.1 §决策七 + CLAUDE.md §六: 禁止业务代码硬编码颜色或绕过 token 体系
  //
  // 禁止：
  //   - 直接 hex/rgb/oklch 字面量在业务代码中（应通过 Foundation token）
  //   - Tailwind 内置色 utility（red-500 / blue-300 等，绕过 Arc 色阶）
  //
  // 允许：
  //   - apps/mobile/global.css 内的 token 定义
  //   - tools/ 下的色阶生成器
  //   - .specify / docs / 注释中的 hex（说明性质，不是运行时）
  // ────────────────────────────────────────────────────────────────────────
  {
    files: [
      "apps/**/*.{ts,tsx}",
      "packages/ui/src/**/*.{ts,tsx}",
      "packages/**/*.{ts,tsx}",
    ],
    ignores: [
      // 例外：色阶生成器输出 + 主题占位 token 文件本身可以含 hex
      "**/tools/**",
      "packages/ui/src/tokens/**",
      "**/__tests__/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // 禁止 hex 字面量（#fff / #112233 / #1234abff）
        {
          selector:
            "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message:
            "Hardcoded hex color is forbidden. Use HeroUI Foundation token (bg-surface / text-foreground / bg-accent ...) or useBusinessClasses() from @arc/ui. See ADR 003 v3.1 §决策七.",
        },
        // 禁止 oklch() / rgb() / rgba() / hsl() 字面量
        {
          selector:
            "Literal[value=/^\\s*(oklch|rgb|rgba|hsl|hsla)\\s*\\(/]",
          message:
            "Hardcoded color function (oklch/rgb/hsl) is forbidden. Use HeroUI Foundation token or useBusinessClasses(). See ADR 003 v3.1 §决策七.",
        },
        // 禁止 Tailwind 内置色 utility（red-500 / blue-300 / green-400 等）
        // 仅匹配类名整体，避免误伤变量名
        {
          selector:
            "Literal[value=/(?:^|\\s)(bg|text|border|ring|fill|stroke|outline|decoration|shadow|caret|accent|placeholder)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|stone|neutral)-(50|100|200|300|400|500|600|700|800|900|950)(?:\\s|$)/]",
          message:
            "Tailwind built-in color utility (e.g. bg-red-500) is forbidden — bypasses Arc color scale. Use HeroUI Foundation utility (bg-danger / bg-success ...) or useBusinessClasses(). See ADR 003 v3.1 §决策七.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // ADR 006 §决策一 + constitution Components rule:
  // Business code MUST go through @arc/ui — never import HeroUI / Lucide /
  // dicebear / safe-area / svg directly. @arc/ui owns the wrapping; pages
  // remain implementation-agnostic so future copy-in or library swap is free.
  //
  // Scope: apps/**/*.{ts,tsx} (consumers). All forbidden paths consolidated
  // into ONE rule config — flat-config does NOT merge rules across blocks
  // (later block overrides earlier), so splitting these into multiple
  // configs silently disabled most of them. Lesson learned 2026-05-16.
  // ────────────────────────────────────────────────────────────────────────
  {
    files: ["apps/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "heroui-native",
              message:
                "Import from `@arc/ui` instead. ADR 006 §决策一: business code is decoupled from the HeroUI implementation layer.",
            },
            {
              name: "heroui-native-pro",
              message:
                "Import from `@arc/ui` instead. ADR 006 §决策一 + license boundary on Pro components.",
            },
            {
              name: "lucide-react-native",
              message:
                "Import icons from `@arc/ui` (wrappers/icons hub). ADR 006 §决策一.",
            },
            {
              name: "react-native-svg",
              message:
                "If you need SVG primitives, expose them through `@arc/ui/wrappers`. ADR 006 §决策一.",
            },
            {
              name: "@dicebear/core",
              message: "Use `<UserAvatar>` from `@arc/ui`. ADR 004 + ADR 006 §决策一.",
            },
            {
              name: "@dicebear/collection",
              message: "Use `<UserAvatar>` from `@arc/ui`. ADR 004 + ADR 006 §决策一.",
            },
            {
              name: "react-native-safe-area-context",
              message:
                "Use `<Screen>` from `@arc/ui` for per-page safe-area handling (ADR 006 §决策七). Root setup in app/_layout.tsx is exempted (separate ESLint override).",
            },
          ],
          patterns: [
            {
              group: ["@gorhom/*"],
              message:
                "Bottom-sheet primitives should live in `@arc/ui/wrappers` (or use HeroUI's BottomSheet). ADR 006 §决策一.",
            },
          ],
        },
      ],
    },
  },
  // Override: _layout.tsx is the root provider tree — legitimately needs
  // SafeAreaProvider + GestureHandlerRootView (providers, not UI). Disable
  // the rule entirely here; the very small surface area + obvious purpose
  // of the file makes the targeted-deny vs. blanket-allow choice OK.
  {
    files: ["apps/mobile/app/_layout.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
