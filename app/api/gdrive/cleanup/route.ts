/**
 * POST /api/gdrive/cleanup
 *
 * Elimina archivos/carpetas de Drive y opcionalmente limpia gdrive_url en la DB.
 *
 * Body: {
 *   folderId?: string,      // carpeta a vaciar + eliminar
 *   gastoIds?: string[],    // IDs de gastos cuyo gdrive_url limpiar en la DB
 *   facturaIds?: string[],  // IDs de facturas cuyo gdrive_url limpiar en la DB
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const API_SECRET   = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();
const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

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

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-api-secret");
  if (secret !== API_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { folderId, gastoIds, facturaIds } = await req.json();
    const log: string[] = [];

    if (folderId) {
      const drive = getDriveClient();

      // Listar todo el contenido de la carpeta (archivos + subcarpetas)
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id,name,mimeType)",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 200,
      });

      const items = res.data.files ?? [];

      // Eliminar todos los elementos
      for (const item of items) {
        await drive.files.delete({ fileId: item.id!, supportsAllDrives: true });
        const tipo = item.mimeType === "application/vnd.google-apps.folder" ? "carpeta" : "archivo";
        log.push(`Eliminado ${tipo}: ${item.name} (${item.id})`);
      }

      // Eliminar la carpeta raíz
      await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
      log.push(`Eliminada carpeta raíz: ${folderId}`);
    }

    // Limpiar gdrive_url de gastos en la DB
    if (gastoIds?.length) {
      for (const id of gastoIds) {
        await fetch(`${INSFORGE_URL}/api/database/records/gastos?id=eq.${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
          body: JSON.stringify({ gdrive_url: null }),
        });
        log.push(`gdrive_url limpiado para gasto: ${id}`);
      }
    }

    // Limpiar gdrive_url de facturas en la DB
    if (facturaIds?.length) {
      for (const id of facturaIds) {
        await fetch(`${INSFORGE_URL}/api/database/records/facturas?id=eq.${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
          body: JSON.stringify({ gdrive_url: null }),
        });
        log.push(`gdrive_url limpiado para factura: ${id}`);
      }
    }

    return NextResponse.json({ ok: true, log });

  } catch (err: any) {
    console.error("[gdrive/cleanup] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
