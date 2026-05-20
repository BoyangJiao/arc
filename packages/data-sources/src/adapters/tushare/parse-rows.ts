import type { TushareRows } from "./client";

export const rowAtIndex = (rows: TushareRows, index: number): Record<string, unknown> => {
  const item = rows.items[index];
  if (!item) {
    throw new Error(`row index ${index} out of range`);
  }
  const out: Record<string, unknown> = {};
  for (let i = 0; i < rows.fields.length; i++) {
    const field = rows.fields[i];
    if (field) out[field] = item[i];
  }
  return out;
};

/** YYYYMMDD → 15:00 Asia/Shanghai = 07:00 UTC (S3-AC-A1.1) */
export const cnTradeDateToAsOf = (tradeDate: string): string => {
  const y = Number(tradeDate.slice(0, 4));
  const m = Number(tradeDate.slice(4, 6)) - 1;
  const d = Number(tradeDate.slice(6, 8));
  return new Date(Date.UTC(y, m, d, 7, 0, 0)).toISOString();
};

export const formatYmd = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};
