/**
 * Drizzle Kit 配置 — schema 编译 + migration 生成
 *
 * 用法：
 *   pnpm --filter @arc/db generate    # 对比 schema vs 上次快照，生成 SQL 增量
 *   pnpm --filter @arc/db migrate     # 通过 Supabase MCP `apply_migration` 工具应用（推荐）
 *
 * 不直接 `drizzle-kit push` —— 该命令绕过 migration 文件，破坏可审计性。
 * 我们的工作流：generate SQL → 人工 review → MCP apply_migration（写入 supabase_migrations）
 */

import "dotenv/config";

import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV !== "test") {
  // generate 命令不需要真实连接，但 push/introspect 需要
  console.warn(
    "[drizzle.config] DATABASE_URL not set — only `generate` will work; push/introspect will fail"
  );
}

export default {
  schema: "./src/schema/*",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgresql://placeholder",
  },
  verbose: true,
  strict: true,
  // 表名前缀（无）— Arc 单 schema，不需要租户隔离前缀
  tablesFilter: ["!auth.*", "!storage.*", "!realtime.*"],
} satisfies Config;
