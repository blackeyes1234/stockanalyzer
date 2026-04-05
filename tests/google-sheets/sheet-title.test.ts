import { describe, expect, it } from "vitest";
import {
  quoteSheetTitleForRange,
  sanitizeWorksheetTitle,
} from "@/lib/google-sheets/sheet-title";

describe("sanitizeWorksheetTitle", () => {
  it("uppercases and strips illegal characters", () => {
    expect(sanitizeWorksheetTitle("qqq")).toBe("QQQ");
    expect(sanitizeWorksheetTitle("BRK.B")).toBe("BRK.B");
    expect(sanitizeWorksheetTitle("BAD/NAME")).toBe("BADNAME");
  });

  it("uses DATA when nothing remains", () => {
    expect(sanitizeWorksheetTitle("///")).toBe("DATA");
  });
});

describe("quoteSheetTitleForRange", () => {
  it("wraps in single quotes and escapes internal quotes", () => {
    expect(quoteSheetTitleForRange("QQQ")).toBe("'QQQ'");
    expect(quoteSheetTitleForRange("O'Brien")).toBe("'O''Brien'");
  });
});
