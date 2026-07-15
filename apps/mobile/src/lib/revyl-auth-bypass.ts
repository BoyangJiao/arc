/**
 * revyl-auth-bypass — Revyl 云测试专用的登录快捷入口。
 *
 * ADR 007 合规性说明：这**不是** auth 链路短路。处理器走真实的
 * `supabase.auth.signInWithPassword`（真 Auth、真 session、真 RLS），
 * 只是把「人工收邮件验证码」这一步替换为测试凭据注入 —— 属于
 * ADR 007 允许的「减少操作步骤」，不属于被禁止的 `if (DEV_*) return mock`。
 *
 * 三重防线（参照 Revyl 官方 auth-bypass skill 的 safety contract）：
 *   1. 构建期门禁 — `EXPO_PUBLIC_REVYL_BYPASS` 只在 eas.json 的
 *      `revyl-build` profile 设为 "true"；preview / production 构建中
 *      该值为 undefined，`REVYL_BYPASS_ENABLED` 内联为 false，处理器死代码。
 *   2. 邮箱 allowlist — 只接受 Clean 测试账号，防止该入口被用于任意账号。
 *   3. 凭据不入库 — 密码由 Revyl launch var / 测试变量经 deep link 注入，
 *      仓库中不出现任何凭据。
 *
 * Deep link 形态（scheme 见 app.json）：
 *   arc://revyl-auth?email=<allowlisted-email>&password=<test-password>
 */

// process.env.* 由 Metro 在打包期内联；运行时不可变。
export const REVYL_BYPASS_ENABLED = process.env.EXPO_PUBLIC_REVYL_BYPASS === "true";

/** 只允许 Clean 环境测试账号走此入口（真实自用账号绝不进 allowlist）。 */
const ALLOWED_EMAILS: ReadonlySet<string> = new Set(["cyberjby+arc-clean@gmail.com"]);

export type RevylBypassRejection =
  | "disabled"
  | "missing_credentials"
  | "email_not_allowlisted"
  | "auth_failed";

export type RevylBypassValidation =
  | { readonly ok: true; readonly email: string; readonly password: string }
  | { readonly ok: false; readonly reason: Exclude<RevylBypassRejection, "auth_failed"> };

/**
 * 纯校验（可单测）：门禁开关 → 凭据齐全 → 邮箱 allowlist。
 * 不触碰网络；通过后才由调用方执行真实登录。
 */
export const validateRevylBypassParams = (
  params: { readonly email?: string | string[]; readonly password?: string | string[] },
  enabled: boolean = REVYL_BYPASS_ENABLED
): RevylBypassValidation => {
  if (!enabled) return { ok: false, reason: "disabled" };

  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const password = typeof params.password === "string" ? params.password : "";
  if (!email || !password) return { ok: false, reason: "missing_credentials" };

  if (!ALLOWED_EMAILS.has(email)) return { ok: false, reason: "email_not_allowlisted" };

  return { ok: true, email, password };
};

export type RevylBypassResult =
  | { readonly status: "signed_in"; readonly email: string }
  | { readonly status: "rejected"; readonly reason: RevylBypassRejection };

type PasswordSignIn = (email: string, password: string) => Promise<{ error: Error | null }>;

interface PerformOptions {
  /** 单测注入；默认走 supabase.auth.signInWithPassword。 */
  readonly signIn?: PasswordSignIn;
  /** 单测注入；默认取构建期门禁常量。 */
  readonly enabled?: boolean;
}

/**
 * 校验 + 真实密码登录（signIn / enabled 可注入，便于单测覆盖全链路）。
 */
export const performRevylBypassSignIn = async (
  params: { readonly email?: string | string[]; readonly password?: string | string[] },
  { signIn, enabled = REVYL_BYPASS_ENABLED }: PerformOptions = {}
): Promise<RevylBypassResult> => {
  const validation = validateRevylBypassParams(params, enabled);
  if (!validation.ok) return { status: "rejected", reason: validation.reason };

  const doSignIn: PasswordSignIn =
    signIn ??
    (async (email, password) => {
      const { supabase } = await import("./supabase");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ?? null };
    });

  const { error } = await doSignIn(validation.email, validation.password);
  if (error) return { status: "rejected", reason: "auth_failed" };

  return { status: "signed_in", email: validation.email };
};
