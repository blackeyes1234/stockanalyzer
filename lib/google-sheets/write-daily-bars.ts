import type { sheets_v4 } from "googleapis";
import { quoteSheetTitleForRange } from "./sheet-title";

/**
 * Ensures a worksheet exists, clears columns A–H, writes values from A1.
 */
export async function ensureSheetAndWriteValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  values: (string | number | boolean)[][],
): Promise<void> {
  const { data: meta } = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.sheets ?? []).some(
    (s) => s.properties?.title === sheetTitle,
  );

  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: sheetTitle },
            },
          },
        ],
      },
    });
  }

  const q = quoteSheetTitleForRange(sheetTitle);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${q}!A:H`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${q}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
