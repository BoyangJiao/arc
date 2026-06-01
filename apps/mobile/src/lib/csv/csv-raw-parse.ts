/**
 * L1 — RFC 4180 raw CSV parser.
 *
 * Format-agnostic: text → { header, rows }.
 * Does not know anything about Arc domain fields.
 *
 * Handles:
 * - CRLF and LF line endings
 * - Double-quoted fields (may contain commas, quotes, newlines)
 * - Escaped double-quotes ("" inside a quoted field)
 * - Trailing newline (skipped)
 */

export interface RawParseResult {
  /** Column names from the first row. Empty if the input is blank. */
  readonly header: readonly string[];
  /** Each row maps column name → raw string value. */
  readonly rows: ReadonlyArray<Readonly<Record<string, string>>>;
}

/**
 * Split one RFC 4180 line into fields.
 * Exported for unit testing; the main entry point is parseRawCsv.
 */
export const splitCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // Trailing comma produces one empty field at end
      if (fields.length === 0) {
        fields.push("");
      }
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            // Escaped quote
            value += '"';
            i += 2;
          } else {
            // Closing quote
            i++;
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma separator (or end of line)
      if (line[i] === ",") i++;
    } else {
      // Unquoted field — read until comma or end
      const start = i;
      while (i < line.length && line[i] !== ",") i++;
      fields.push(line.slice(start, i));
      if (line[i] === ",") i++;
    }
  }

  return fields;
};

/**
 * Parse a full CSV text string (RFC 4180).
 *
 * - Normalizes CRLF → LF before splitting.
 * - Strips a single trailing newline.
 * - Returns empty header + empty rows for blank input.
 * - Does NOT handle multi-line quoted fields that span multiple physical lines
 *   (Arc export does not emit them, and spec does not require cross-line support).
 *   The notes field uses \n within a quoted field on a single row (RFC 4180 §2.6).
 *
 * Note: Our export always writes notes on one line using \r\n row separators,
 * so multi-line within a cell is not expected in practice but we keep the parser
 * simple and documented.
 */
export const parseRawCsv = (text: string): RawParseResult => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;

  if (trimmed.trim() === "") {
    return { header: [], rows: [] };
  }

  const lines = trimmed.split("\n");
  const header = splitCsvLine(lines[0]);

  if (lines.length === 1) {
    return { header, rows: [] };
  }

  const rows: Readonly<Record<string, string>>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { header, rows };
};
