/**
 * Supabase JS 客户端工厂
 *
 * 用途：业务代码（apps/mobile / packages/data-sources）查询 Postgres 与 Auth。
 * 走 Supabase JS SDK 而非直连 Postgres，原因：
 *   1. 自动注入 Auth JWT → RLS 自动生效
 *   2. 移动端只能走 HTTP，不能开持久 Postgres 连接
 *   3. 与 Supabase Auth / Realtime / Storage 同一 client
 *
 * Drizzle Schema 在 `./schema` 用作类型推断 + drizzle-kit 生成 migration，
 * **不在 runtime 用 Drizzle Query Builder**（runtime 走 supabase-js）。
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  /** 服务端用（Edge Function / 后端 cron），权限绕过 RLS */
  serviceRoleKey?: string;
}

/**
 * 创建标准用户态客户端（受 RLS 约束）
 *
 * 移动端 / Web 端业务代码使用此客户端。Auth session 自动管理。
 */
export const createSupabaseClient = (config: SupabaseClientConfig): SupabaseClient => {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // 移动端用 deep link 处理，不依赖 URL
    },
  });
};

/**
 * 创建 service-role 客户端（绕过 RLS）
 *
 * 仅用于：数据源 adapter cron job 写入 price_snapshots / fx_rates。
 * **绝不在客户端代码中使用**；service-role key 必须只在 server 环境暴露。
 */
export const createServiceRoleClient = (config: Required<SupabaseClientConfig>): SupabaseClient => {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
