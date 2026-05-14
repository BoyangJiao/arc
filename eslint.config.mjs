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
];
