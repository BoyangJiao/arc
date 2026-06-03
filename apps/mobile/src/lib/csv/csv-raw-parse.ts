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
 * Split CSV text into logical records, respecting RFC 4180 §2.6 — a newline
 * inside a double-quoted field does NOT end the record.
 *
 * A naive `text.split("\n")` breaks any notes value that contains a line break
 * (which our own export legitimately emits as `"line1\nline2"`), splitting one
 * transaction across several "rows" and corrupting the import (FI.9). This walks
 * the whole string once, tracking quote state, and only cuts a record on a
 * newline that is outside quotes.
 *
 * Input must already be LF-normalized. Quote chars are kept verbatim; field-level
 * unescaping is done by {@link splitCsvLine}.
 */
const splitCsvRecords = (text: string): string[] => {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // Escaped quote ("") — stays inside the field, keep both chars.
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === "\n" && !inQuotes) {
      records.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current !== "") records.push(current);

  return records;
};

/**
 * Parse a full CSV text string (RFC 4180).
 *
 * - Normalizes CRLF → LF.
 * - Strips a single trailing newline.
 * - Returns empty header + empty rows for blank input.
 * - **Handles multi-line quoted fields** (e.g. a notes value containing a line
 *   break, which Arc export emits as `"a\nb"`) via {@link splitCsvRecords} —
 *   records are cut only on newlines outside quotes (FI.9 fix).
 */
export const parseRawCsv = (text: string): RawParseResult => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;

  if (trimmed.trim() === "") {
    return { header: [], rows: [] };
  }

  const records = splitCsvRecords(trimmed);
  const header = splitCsvLine(records[0]);

  if (records.length === 1) {
    return { header, rows: [] };
  }

  const rows: Readonly<Record<string, string>>[] = [];
  for (let i = 1; i < records.length; i++) {
    const values = splitCsvLine(records[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { header, rows };
};
