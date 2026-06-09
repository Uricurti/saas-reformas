/**
 * POST /api/gdrive/export
 *
 * Sube PDFs de gastos al Google Drive de la gestora.
 * Estructura: FACTURAS {año} / T{1-4} / {actividad} / [subInmueble/] Gastos /
 *   - actividad: "REFORMAS" | "GESTIÓN" | "FLIPPING HOUSE"  (default: REFORMAS)
 *   - subInmueble: solo si actividad === "FLIPPING HOUSE"
 *
 * Body: {
 *   facturas: Array<{ id?, numero, pdf_url, mes, anio, actividad?, subInmueble? }>
 *   empresa?: "carranzacortina" | "reforlife"   (default: carranzacortina)
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

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

// ─── IDs de carpetas raíz ─────────────────────────────────────────────────────
// Carpeta oficial: CARRANZACORTINAINTERIORS SL - COMPARTIDA (Shared Drive gestora)
const GDRIVE_ROOT_CARRANZA  = process.env.GDRIVE_ROOT_CARRANZA  ?? "1bZj_53iRTfh4eYvpVg8b01R27Covvzkf";
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

// ─── Buscar o crear carpeta (con matching case-insensitive + trim) ─────────────
// Lista todos los subfolders del padre y busca por nombre ignorando mayúsculas
// y espacios extra. Si no existe, la crea. Esto evita crear duplicados cuando
// la gestora tiene nombres como "REFORMAS " (con espacio al final).
const folderCache = new Map<string, string>();

async function getOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const trimmedName = name.trim();
  const cacheKey = `${parentId}/${trimmedName.toLowerCase()}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

  // Listar todas las subcarpetas y buscar por coincidencia exacta (sin case ni espacios)
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 100,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const match = (res.data.files ?? []).find(
    (f: any) => f.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );

  if (match) {
    folderCache.set(cacheKey, match.id!);
    return match.id!;
  }

  // No encontrada — crear con nombre limpio
  const created = await drive.files.create({
    requestBody: { name: trimmedName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  folderCache.set(cacheKey, created.data.id!);
  return created.data.id!;
}

// ─── Obtener carpeta destino Gastos ──────────────────────────────────────────
// Navega: raíz → FACTURAS {año} → T{n} → {actividad} → [subInmueble →] Gastos
async function getGastosFolderId(
  drive: any,
  empresa: string,
  anio: number,
  mes: number,
  actividad: string = "REFORMAS",
  subInmueble?: string,
): Promise<string> {
  const trimestre = TRIMESTRE[mes];

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

  const facturasId  = await getOrCreateFolder(drive, `FACTURAS ${anio}`, rootId);
  const trimestreId = await getOrCreateFolder(drive, trimestre, facturasId);
  const actividadId = await getOrCreateFolder(drive, actividad, trimestreId);

  // FLIPPING HOUSE: nivel extra con el inmueble específico
  if (actividad.toUpperCase() === "FLIPPING HOUSE" && subInmueble) {
    const inmuebleId = await getOrCreateFolder(drive, subInmueble, actividadId);
    return await getOrCreateFolder(drive, "Gastos", inmuebleId);
  }

  return await getOrCreateFolder(drive, "Gastos", actividadId);
}

// ─── Descargar PDF desde InsForge Storage ─────────────────────────────────────
async function downloadPdf(pdfUrl: string): Promise<Buffer> {
  if (!pdfUrl.startsWith("http")) {
    // Clave de storage — pedir al API de InsForge
    const res = await fetch(
      `${INSFORGE_URL}/api/storage/buckets/obras-media/objects/${encodeURIComponent(pdfUrl)}`,
      { headers: { "x-api-key": SERVICE_KEY } }
    );
    if (!res.ok) throw new Error(`No se pudo obtener el PDF del storage: ${res.status}`);

    // InsForge puede devolver el binario directamente O un JSON con signedUrl
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      const signedUrl = data.signedUrl ?? data.url;
      if (!signedUrl) throw new Error("InsForge no devolvió URL firmada");
      const r2 = await fetch(signedUrl);
      if (!r2.ok) throw new Error(`Error descargando PDF desde URL firmada: ${r2.status}`);
      return Buffer.from(await r2.arrayBuffer());
    }
    // Respuesta binaria directa (PDF)
    return Buffer.from(await res.arrayBuffer());
  }

  // Ya es una URL pública
  const res = await fetch(pdfUrl);
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
        actividad?: string;    // default: REFORMAS
        subInmueble?: string;  // solo para FLIPPING HOUSE
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
        const actividad   = factura.actividad ?? "REFORMAS";
        const subInmueble = actividad.toUpperCase() === "FLIPPING HOUSE" ? factura.subInmueble : undefined;

        // Obtener carpeta destino según actividad
        const gastosFolderId = await getGastosFolderId(
          drive, empresa, factura.anio, factura.mes, actividad, subInmueble
        );

        // Descargar PDF desde InsForge Storage
        const pdfBuffer = await downloadPdf(factura.pdf_url);

        // Subir a Drive
        await drive.files.create({
          requestBody: {
            name: `${factura.numero}.pdf`,
            mimeType: "application/pdf",
            parents: [gastosFolderId],
          },
          media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
          fields: "id",
          supportsAllDrives: true,
        });

        // Guardamos la URL de la CARPETA para que el usuario pueda verificar
        // exactamente dónde está colocado el PDF en Drive.
        const driveUrl = `https://drive.google.com/drive/folders/${gastosFolderId}`;

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
