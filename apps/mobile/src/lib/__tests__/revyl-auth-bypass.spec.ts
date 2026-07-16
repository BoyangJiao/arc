import { describe, expect, it, vi } from "vitest";

import { performRevylBypassSignIn, validateRevylBypassParams } from "../revyl-auth-bypass";

const CLEAN_EMAIL = "cyberjby+arc-clean@gmail.com";

describe("validateRevylBypassParams", () => {
  it("rejects when the build-time gate is disabled, regardless of credentials", () => {
    const r = validateRevylBypassParams({ email: CLEAN_EMAIL, password: "pw" }, false);
    expect(r).toEqual({ ok: false, reason: "disabled" });
  });

  it("rejects missing email or password", () => {
    expect(validateRevylBypassParams({ password: "pw" }, true)).toEqual({
      ok: false,
      reason: "missing_credentials",
    });
    expect(validateRevylBypassParams({ email: CLEAN_EMAIL }, true)).toEqual({
      ok: false,
      reason: "missing_credentials",
    });
  });

  it("rejects array-typed params (repeated query keys) as missing credentials", () => {
    const r = validateRevylBypassParams(
      { email: [CLEAN_EMAIL, CLEAN_EMAIL], password: "pw" },
      true
    );
    expect(r).toEqual({ ok: false, reason: "missing_credentials" });
  });

  it("rejects emails outside the allowlist (including the real self-use account)", () => {
    for (const email of ["cyberjby@gmail.com", "cyberjby+arc-real@gmail.com", "a@b.c"]) {
      expect(validateRevylBypassParams({ email, password: "pw" }, true)).toEqual({
        ok: false,
        reason: "email_not_allowlisted",
      });
    }
  });

  it("accepts the allowlisted clean account, normalizing case and whitespace", () => {
    const r = validateRevylBypassParams(
      { email: `  ${CLEAN_EMAIL.toUpperCase()}  `, password: "pw" },
      true
    );
    expect(r).toEqual({ ok: true, email: CLEAN_EMAIL, password: "pw" });
  });

  it("restores '+' from URL-decoded spaces in the email local part", () => {
    // arc://revyl-auth?email=cyberjby+arc-clean@… 深链解码后 + 变空格。
    const r = validateRevylBypassParams(
      { email: "cyberjby arc-clean@gmail.com", password: "pw" },
      true
    );
    expect(r).toEqual({ ok: true, email: CLEAN_EMAIL, password: "pw" });
  });
});

describe("performRevylBypassSignIn", () => {
  it("is rejected as disabled by default in non-Revyl builds (gate inlined false)", async () => {
    const signIn = vi.fn();
    const r = await performRevylBypassSignIn({ email: CLEAN_EMAIL, password: "pw" }, { signIn });
    expect(r).toEqual({ status: "rejected", reason: "disabled" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("does not call signIn when the email is not allowlisted", async () => {
    const signIn = vi.fn();
    const r = await performRevylBypassSignIn(
      { email: "cyberjby+arc-real@gmail.com", password: "pw" },
      { signIn, enabled: true }
    );
    expect(r).toEqual({ status: "rejected", reason: "email_not_allowlisted" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("maps sign-in errors to auth_failed", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: new Error("bad credentials") });
    const r = await performRevylBypassSignIn(
      { email: CLEAN_EMAIL, password: "wrong" },
      { signIn, enabled: true }
    );
    expect(r).toEqual({ status: "rejected", reason: "auth_failed" });
    expect(signIn).toHaveBeenCalledWith(CLEAN_EMAIL, "wrong");
  });

  it("returns signed_in with the normalized email when signIn succeeds", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });
    const r = await performRevylBypassSignIn(
      { email: ` ${CLEAN_EMAIL.toUpperCase()} `, password: "pw" },
      { signIn, enabled: true }
    );
    expect(r).toEqual({ status: "signed_in", email: CLEAN_EMAIL });
    expect(signIn).toHaveBeenCalledWith(CLEAN_EMAIL, "pw");
  });
});
