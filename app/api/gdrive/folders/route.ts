/**
 * GET /api/gdrive/folders
 * Lista las carpetas del Drive compartido para ver la estructura.
 * Usado internamente para detectar la organización de carpetas.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const API_SECRET = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();

function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-api-secret");
  if (secret !== API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parentId = req.nextUrl.searchParams.get("parentId") ?? "root";

  try {
    const drive = getDriveClient();
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name, parents)",
      orderBy: "name",
      pageSize: 100,
    });

    return NextResponse.json({ folders: res.data.files ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
