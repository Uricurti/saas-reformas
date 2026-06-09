/**
 * GET /api/gdrive/debug
 * Diagnóstico completo: Shared Drives + todas las carpetas accesibles
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
  if (secret !== API_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const drive = getDriveClient();

    // 1. Buscar Shared Drives
    const sharedDrivesRes = await drive.drives.list({
      pageSize: 20,
      fields: "drives(id,name,kind)",
    });
    const sharedDrives = sharedDrivesRes.data.drives ?? [];

    // 2. Carpetas con sharedWithMe=true
    const sharedFoldersRes = await drive.files.list({
      q: "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id,name,driveId,parents,shared,ownedByMe)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 50,
    });
    const sharedFolders = sharedFoldersRes.data.files ?? [];

    // 3. Todas las carpetas accesibles (sin filtro sharedWithMe)
    const allFoldersRes = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id,name,driveId,parents,shared,ownedByMe)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: "allDrives",
      pageSize: 50,
    });
    const allFolders = allFoldersRes.data.files ?? [];

    // 4. Probar si la carpeta carranzacortina está en un Shared Drive
    const testFolderId = "105BCJ0gtsNGExG-U2vLjkO9X1MSnQzXT";
    let folderMeta: any = null;
    try {
      const metaRes = await drive.files.get({
        fileId: testFolderId,
        fields: "id,name,driveId,parents,shared,ownedByMe,capabilities",
        supportsAllDrives: true,
      });
      folderMeta = metaRes.data;
    } catch (e: any) {
      folderMeta = { error: e.message };
    }

    return NextResponse.json({
      sharedDrives,
      sharedFolders: sharedFolders.map(f => ({ id: f.id, name: f.name, driveId: f.driveId, ownedByMe: f.ownedByMe })),
      allFolders: allFolders.map(f => ({ id: f.id, name: f.name, driveId: f.driveId, ownedByMe: f.ownedByMe })),
      testFolderMeta: folderMeta,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
