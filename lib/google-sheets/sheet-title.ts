/** Sheet titles cannot contain : \ / ? * [ ] and are max 100 chars. */
export function sanitizeWorksheetTitle(rawSymbol: string): string {
  const s = rawSymbol
    .trim()
    .toUpperCase()
    .replace(/[:\\/?*[\]]/g, "")
    .slice(0, 100);
  return s.length > 0 ? s : "DATA";
}

/** A1 range prefix for a sheet tab name (escapes quotes). */
export function quoteSheetTitleForRange(title: string): string {
  const escaped = title.replace(/'/g, "''");
  return `'${escaped}'`;
}
