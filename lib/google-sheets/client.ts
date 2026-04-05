import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { getSheetsServiceAccountFromEnv } from "./credentials";

export type CreateSheetsClientResult =
  | { ok: true; sheets: sheets_v4.Sheets }
  | { ok: false; message: string };

/**
 * Authenticated Sheets API client (service account). Server-only.
 */
export async function createSheetsClient(): Promise<CreateSheetsClientResult> {
  const creds = getSheetsServiceAccountFromEnv();
  if (!creds) {
    return {
      ok: false,
      message:
        "Google Sheets export is not configured. Set GOOGLE_SHEETS_EXPORT_SPREADSHEET_ID and GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON or GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY_BASE64.",
    };
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();

  return { ok: true, sheets: google.sheets({ version: "v4", auth }) };
}
