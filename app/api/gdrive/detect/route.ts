/**
 * GET /api/gdrive/detect
 * Detecta las carpetas a las que tiene acceso la service account.
 * Cuando el admin acepta el compartir, esta llamada devuelve la carpeta raíz.
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

  try {
    const drive = getDriveClient();

    // Listar todos los archivos/carpetas compartidos con la service account
    const res = await drive.files.list({
      q: "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name, parents, owners)",
      orderBy: "name",
      pageSize: 20,
    });

    const carpetas = res.data.files ?? [];

    return NextResponse.json({
      acceso: carpetas.length > 0,
      carpetas: carpetas.map(f => ({ id: f.id, name: f.name })),
      mensaje: carpetas.length > 0
        ? `✅ Acceso confirmado — ${carpetas.length} carpeta(s) disponible(s)`
        : "⏳ Aún sin acceso — el admin no ha aceptado todavía",
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
