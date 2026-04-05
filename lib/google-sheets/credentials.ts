export type ParsedServiceAccount = {
  client_email: string;
  private_key: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Reads service account JSON from server env. Never log the result.
 * Prefer `GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY_BASE64` on hosts that dislike multiline JSON in env.
 */
export function getSheetsServiceAccountFromEnv(): ParsedServiceAccount | null {
  const b64 = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY_BASE64?.trim();
  const rawJson = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim();

  let text: string | undefined;
  if (b64) {
    try {
      text = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      return null;
    }
  } else if (rawJson) {
    text = rawJson;
  } else {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return null;
    const email = parsed.client_email;
    const key = parsed.private_key;
    if (typeof email !== "string" || typeof key !== "string") return null;
    if (!email.includes("@") || !key.includes("BEGIN")) return null;
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function getGoogleSheetsSpreadsheetIdFromEnv(): string | null {
  const id = process.env.GOOGLE_SHEETS_EXPORT_SPREADSHEET_ID?.trim();
  return id || null;
}

export function isGoogleSheetsExportEnvConfigured(): boolean {
  return (
    Boolean(getGoogleSheetsSpreadsheetIdFromEnv()) &&
    Boolean(getSheetsServiceAccountFromEnv())
  );
}
