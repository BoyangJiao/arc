/**
 * Amount redaction — display-only mask for monetary strings (ADR 003 §决策六).
 *
 * Does not alter colors or percent-only lines; consumers pass `redactAmount` on
 * combined PnL formatters or swap formatted money for {@link AMOUNT_REDACTION_MASK}.
 */

/** Fixed mask for any redacted monetary display (e.g. ¥1,234.56 → ••••). */
export const AMOUNT_REDACTION_MASK = "••••";
