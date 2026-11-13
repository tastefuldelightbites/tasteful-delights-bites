import { query } from './db';

/**
 * Which newer columns the database has. The site works either way: before the
 * database update has added a column, the features that use it simply wait.
 * Checked once per server, and again every 2 minutes while something is missing.
 */
const g = globalThis as unknown as { __tdbCols?: { at: number; cols: Set<string> } };

export async function hasColumn(table: string, column: string): Promise<boolean> {
  const c = g.__tdbCols;
  const key = `${table}.${column}`;
  if (c && (c.cols.has(key) || Date.now() - c.at < 120_000)) return c.cols.has(key);
  try {
    const rows = await query((sql) => sql<{ t: string; c: string }[]>`
      select table_name as t, column_name as c from information_schema.columns
      where table_schema = 'public' and ((table_name = 'products' and column_name = 'picks') or (table_name = 'order_items' and column_name = 'cakes'))`,
      'Checking the database layout', { expect: ['t', 'c'] });
    g.__tdbCols = { at: Date.now(), cols: new Set(rows.map((r) => `${r.t}.${r.c}`)) };
  } catch {
    return c?.cols.has(key) ?? false;
  }
  return g.__tdbCols.cols.has(key);
}

/** Forget what we knew about the columns (after the database update adds them). */
export function recheckColumns() {
  g.__tdbCols = undefined;
}
