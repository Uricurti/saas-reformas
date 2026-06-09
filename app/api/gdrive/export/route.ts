/**
 * POST /api/gdrive/export
 *
 * Sube PDFs de facturas al Google Drive de la gestora.
 * Estructura: {empresa} / facturas {año} / T{1-4} / Gastos /
 *
 * Body: {
 *   facturas: Array<{ id?, numero, pdf_url, mes, anio }>
 *   empresa?: "carranzacortina" | "reforlife"   (default: carranzacortina)
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const API_SECRET   = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();
const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

// ─── Trimestre por mes ────────────────────────────────────────────────────────
const TRIMESTRE: Record<number, string> = {
  1:"T1", 2:"T1", 3:"T1",
  4:"T2", 5:"T2", 6:"T2",
  7:"T3", 8:"T3", 9:"T3",
  10:"T4", 11:"T4", 12:"T4",
};

// ─── IDs de carpetas raíz (configurables via env vars) ───────────────────────
// Cambiar estas variables cuando se use la carpeta real de la gestora.
// La estructura esperada dentro de cada raíz es:
//   facturas {año} / T{1-4} / Gastos /
const GDRIVE_ROOT_CARRANZA  = process.env.GDRIVE_ROOT_CARRANZA  ?? "105BCJ0gtsNGExG-U2vLjkO9X1MSnQzXT"; // carpeta de pruebas
const GDRIVE_ROOT_REFORLIFE = process.env.GDRIVE_ROOT_REFORLIFE ?? ""; // pendiente de acceso

// ─── Auth Drive ───────────────────────────────────────────────────────────────
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

// ─── Buscar o crear carpeta ───────────────────────────────────────────────────
const folderCache = new Map<string, string>();

async function getOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const key = `${parentId}/${name}`;
  if (folderCache.has(key)) return folderCache.get(key)!;

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  if (res.data.files?.length) {
    folderCache.set(key, res.data.files[0].id!);
    return res.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  folderCache.set(key, created.data.id!);
  return created.data.id!;
}

// ─── Obtener carpeta destino para una factura ─────────────────────────────────
// Navega por nombre: raíz → "facturas {año}" → "T{n}" → "Gastos"
// Si alguna subcarpeta no existe, la crea automáticamente.
async function getGastosFolderId(drive: any, empresa: string, anio: number, mes: number): Promise<string> {
  const trimestre = TRIMESTRE[mes];
  const anioStr   = String(anio);

  let rootId: string;
  if (empresa === "carranzacortina") {
    if (!GDRIVE_ROOT_CARRANZA) throw new Error("GDRIVE_ROOT_CARRANZA no configurado");
    rootId = GDRIVE_ROOT_CARRANZA;
  } else if (empresa === "reforlife") {
    if (!GDRIVE_ROOT_REFORLIFE) throw new Error("Carpeta de Reforlife aún no configurada — pendiente de acceso al Drive");
    rootId = GDRIVE_ROOT_REFORLIFE;
  } else {
    throw new Error(`Empresa desconocida: ${empresa}`);
  }

  // Navegar por nombre (funciona con cualquier año y estructura futura)
  const facturasId  = await getOrCreateFolder(drive, `facturas ${anioStr}`, rootId);
  const trimestreId = await getOrCreateFolder(drive, trimestre, facturasId);
  return await getOrCreateFolder(drive, "Gastos", trimestreId);
}

// ─── Descargar PDF desde InsForge Storage ─────────────────────────────────────
async function downloadPdf(pdfUrl: string): Promise<Buffer> {
  let url = pdfUrl;
  if (!pdfUrl.startsWith("http")) {
    const res = await fetch(
      `${INSFORGE_URL}/api/storage/buckets/obras-media/objects/${encodeURIComponent(pdfUrl)}`,
      { headers: { "x-api-key": SERVICE_KEY } }
    );
    if (!res.ok) throw new Error(`No se pudo obtener URL del PDF: ${res.status}`);
    const data = await res.json();
    url = data.signedUrl ?? data.url ?? pdfUrl;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el PDF: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Guardar gdrive_url en la DB ──────────────────────────────────────────────
async function saveGdriveUrl(gastoId: string, driveUrl: string) {
  try {
    await fetch(`${INSFORGE_URL}/api/database/records/gastos?id=eq.${gastoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
      body: JSON.stringify({ gdrive_url: driveUrl }),
    });
  } catch { /* non-fatal */ }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-api-secret");
  if (secret !== API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { facturas, empresa = "carranzacortina" } = body as {
      facturas: Array<{
        id?: string;
        numero: string;
        pdf_url: string;
        mes: number;
        anio: number;
      }>;
      empresa?: string;
    };

    if (!facturas?.length) {
      return NextResponse.json({ error: "Faltan facturas" }, { status: 400 });
    }

    const drive = getDriveClient();
    folderCache.clear();

    const resultados: Array<{ numero: string; ok: boolean; driveUrl?: string; error?: string }> = [];

    for (const factura of facturas) {
      try {
        // Obtener carpeta destino: {empresa} / facturas {año} / T{n} / Gastos
        const gastosFolderId = await getGastosFolderId(drive, empresa, factura.anio, factura.mes);

        // Descargar PDF desde InsForge Storage
        const pdfBuffer = await downloadPdf(factura.pdf_url);

        // Subir a Drive
        const { Readable } = await import("stream");
        const uploaded = await drive.files.create({
          requestBody: {
            name: `${factura.numero}.pdf`,
            mimeType: "application/pdf",
            parents: [gastosFolderId],
          },
          media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
          fields: "id, webViewLink",
          supportsAllDrives: true,
        });

        const driveUrl = uploaded.data.webViewLink
          ?? `https://drive.google.com/file/d/${uploaded.data.id}/view`;

        // Persistir en la DB
        if (factura.id) await saveGdriveUrl(factura.id, driveUrl);

        resultados.push({ numero: factura.numero, ok: true, driveUrl });

      } catch (err: any) {
        resultados.push({ numero: factura.numero, ok: false, error: err.message });
      }
    }

    const subidas  = resultados.filter(r => r.ok).length;
    const errores  = resultados.filter(r => !r.ok).length;

    return NextResponse.json({
      ok: true,
      subidas,
      errores,
      resultados,
      mensaje: `${subidas} facturas subidas a Google Drive${errores ? `, ${errores} con error` : ""}`,
    });

  } catch (err: any) {
    console.error("[gdrive/export] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
