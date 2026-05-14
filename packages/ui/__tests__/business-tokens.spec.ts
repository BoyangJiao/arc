/**
 * Property-based tests for Business token mapping.
 *
 * Enforces ADR 003 v3.1 §决策五:
 *   - red↔green-down 切换在 Business 层完成（Foundation 永远不变）
 *   - gain 与 loss 永远互为反色
 *   - pnlNeutral 永远 muted（不参与切换）
 *   - deviation tokens 不参与涨跌切换
 *
 * 如果任何一项 fail，红涨绿跌切换的核心契约被破坏。
 */

import { describe, expect, test } from "vitest";
import * as fc from "fast-check";

import {
  buildBusinessTokens,
  DEFAULT_FINANCE_COLOR_MODE,
  type FinanceColorMode,
} from "../src/tokens/business";
import { buildBusinessClasses, tokenToClasses } from "../src/tokens/business-classes";

const modeArb = (): fc.Arbitrary<FinanceColorMode> =>
  fc.constantFrom("redUpGreenDown", "greenUpRedDown");

describe("buildBusinessTokens — invariants", () => {
  test("默认模式下，gain → success / loss → danger", () => {
    const t = buildBusinessTokens("greenUpRedDown");
    expect(t.gain).toBe("success");
    expect(t.loss).toBe("danger");
  });

  test("红涨绿跌模式下，gain → danger / loss → success", () => {
    const t = buildBusinessTokens("redUpGreenDown");
    expect(t.gain).toBe("danger");
    expect(t.loss).toBe("success");
  });

  test("无论哪种模式，gain 与 loss 永远互为反色", () => {
    fc.assert(
      fc.property(modeArb(), (mode) => {
        const t = buildBusinessTokens(mode);
        const opposites = new Set([t.gain, t.loss]);
        return opposites.size === 2 && opposites.has("success") && opposites.has("danger");
      })
    );
  });

  test("pnlNeutral 永远是 muted（不参与涨跌切换）", () => {
    fc.assert(fc.property(modeArb(), (mode) => buildBusinessTokens(mode).pnlNeutral === "muted"));
  });

  test("deviation tokens 不参与涨跌切换（warning-soft / danger-soft 恒定）", () => {
    fc.assert(
      fc.property(modeArb(), (mode) => {
        const t = buildBusinessTokens(mode);
        return t.deviationWarning === "warning-soft" && t.deviationCritical === "danger-soft";
      })
    );
  });

  test("DEFAULT_FINANCE_COLOR_MODE 与 packages/db 默认（greenUpRedDown）一致", () => {
    expect(DEFAULT_FINANCE_COLOR_MODE).toBe("greenUpRedDown");
  });
});

describe("buildBusinessClasses — Tailwind 字面量", () => {
  test("greenUpRedDown 模式下 gain.text === 'text-success'（Tailwind 编译可见）", () => {
    const c = buildBusinessClasses("greenUpRedDown");
    expect(c.gain.text).toBe("text-success");
    expect(c.gain.bg).toBe("bg-success");
    expect(c.gain.bgSoft).toBe("bg-success-soft");
    expect(c.loss.text).toBe("text-danger");
  });

  test("redUpGreenDown 模式下 gain.text === 'text-danger'", () => {
    const c = buildBusinessClasses("redUpGreenDown");
    expect(c.gain.text).toBe("text-danger");
    expect(c.gain.bgSoft).toBe("bg-danger-soft");
    expect(c.loss.text).toBe("text-success");
  });

  test("pnlNeutral 在两种模式下都是 text-muted", () => {
    fc.assert(
      fc.property(modeArb(), (mode) => buildBusinessClasses(mode).pnlNeutral.text === "text-muted")
    );
  });

  test("deviation classes 在两种模式下都恒定", () => {
    fc.assert(
      fc.property(modeArb(), (mode) => {
        const c = buildBusinessClasses(mode);
        return (
          c.deviationWarning.bgSoft === "bg-warning-soft" &&
          c.deviationCritical.bgSoft === "bg-danger-soft"
        );
      })
    );
  });
});

describe("tokenToClasses — 反向工具", () => {
  test("'success' → SUCCESS_CLASSES (text-success / bg-success-soft)", () => {
    expect(tokenToClasses("success").text).toBe("text-success");
    expect(tokenToClasses("success").bgSoft).toBe("bg-success-soft");
  });

  test("'danger' → DANGER_CLASSES (text-danger / bg-danger-soft)", () => {
    expect(tokenToClasses("danger").text).toBe("text-danger");
    expect(tokenToClasses("danger").bgSoft).toBe("bg-danger-soft");
  });

  test("tokenToClasses 与 buildBusinessClasses 在 gain/loss 上一致", () => {
    fc.assert(
      fc.property(modeArb(), (mode) => {
        const t = buildBusinessTokens(mode);
        const c = buildBusinessClasses(mode);
        return (
          tokenToClasses(t.gain).text === c.gain.text && tokenToClasses(t.loss).text === c.loss.text
        );
      })
    );
  });
});

describe("Foundation 永不参与涨跌切换（核心 ADR 005 §决策五）", () => {
  test("greenUpRedDown 下 success 用作 gain；redUpGreenDown 下 success 用作 loss", () => {
    expect(buildBusinessTokens("greenUpRedDown").gain).toBe("success");
    expect(buildBusinessTokens("redUpGreenDown").loss).toBe("success");
    // → success 总是出现，但被赋予不同业务语义；Foundation 值（绿）不变
  });
});
