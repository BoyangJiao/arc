/**
 * @arc/db — Arc 数据访问层
 *
 * Schema：Drizzle 类型定义（`./schema`），编译时类型 + drizzle-kit migration 生成
 * Runtime client：Supabase JS（`./client`），auto-RLS + Auth 集成
 *
 * 业务代码典型用法：
 *   import { createSupabaseClient, type Portfolio } from '@arc/db';
 *   const client = createSupabaseClient({ url, anonKey });
 *   const { data, error } = await client.from('portfolios').select('*');
 *   // data 类型推断为 Portfolio[]（来自 Drizzle inferSelect）
 */

export * from "./schema";
export * from "./client";
