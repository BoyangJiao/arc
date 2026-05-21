/**
 * Arc L2 — hide Cartesian axis labels and grid (Coinbase-style clean chart).
 * @see ADR 013
 */

export const HIDDEN_CARTESIAN_AXIS_PROPS = {
  xAxis: {
    tickCount: 0,
    lineWidth: 0,
    font: null,
  },
  yAxis: [{ tickCount: 0, lineWidth: 0, font: null }],
  frame: { lineWidth: 0 },
  padding: { left: 0, right: 0, top: 4, bottom: 0 },
  domainPadding: { left: 4, right: 4, top: 8, bottom: 8 },
} as const;
