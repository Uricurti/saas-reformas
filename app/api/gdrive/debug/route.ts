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

/** Lista subcarpetas y archivos directos de una carpeta (no recursivo) */
async function listFolder(drive: any, folderId: string): Promise<{ folders: any[]; files: any[] }> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,modifiedTime)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 200,
    orderBy: "name",
  });
  const all = res.data.files ?? [];
  const folders = all.filter((f: any) => f.mimeType === "application/vnd.google-apps.folder");
  const files   = all.filter((f: any) => f.mimeType !== "application/vnd.google-apps.folder");
  return { folders, files };
}

/** Recorre el árbol recursivamente hasta maxDepth niveles */
async function treeOf(drive: any, folderId: string, name: string, depth = 0, maxDepth = 4): Promise<any> {
  if (depth > maxDepth) return { id: folderId, name, children: [], files: [], truncated: true };
  const { folders, files } = await listFolder(drive, folderId);
  const children = await Promise.all(
    folders.map((f: any) => treeOf(drive, f.id, f.name, depth + 1, maxDepth))
  );
  return {
    id: folderId,
    name,
    children,
    files: files.map((f: any) => ({ id: f.id, name: f.name, size: f.size })),
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-api-secret");
  if (secret !== API_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const drive = getDriveClient();
    const { searchParams } = new URL(req.url);

    // Modo árbol: ?tree=folderId
    const treeId = searchParams.get("tree");
    if (treeId) {
      const metaRes = await drive.files.get({
        fileId: treeId,
        fields: "id,name",
        supportsAllDrives: true,
      });
      const tree = await treeOf(drive, treeId, metaRes.data.name ?? treeId);
      return NextResponse.json(tree);
    }

    // Modo listado directo: ?ls=folderId
    const lsId = searchParams.get("ls");
    if (lsId) {
      const { folders, files } = await listFolder(drive, lsId);
      return NextResponse.json({ folders, files });
    }

    // Modo original: info general
    const allFoldersRes = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id,name,driveId,parents)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: "allDrives",
      pageSize: 50,
    });
    return NextResponse.json({ allFolders: allFoldersRes.data.files ?? [] });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
