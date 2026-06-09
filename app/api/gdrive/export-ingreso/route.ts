/**
 * POST /api/gdrive/export-ingreso
 *
 * Se llama cuando un ingreso/factura se marca como "cobrado".
 * Sube el PDF al Drive en la carpeta correcta según la actividad.
 * Estructura: FACTURAS {año} / T{1-4} / {actividad} / [subInmueble/] Ingresos /
 *   - actividad: "REFORMAS" | "GESTIÓN" | "FLIPPING HOUSE"  (default: REFORMAS)
 *   - subInmueble: solo si actividad === "FLIPPING HOUSE"
 *
 * Body: {
 *   factura_id: string,
 *   fecha_cobro?: string,
 *   empresa?: string,
 *   actividad?: string,
 *   subInmueble?: string,
 * }
 *
 * El trimestre se determina por fecha_emision de la factura (no por fecha_cobro).
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

const API_SECRET   = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();
const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

const TRIMESTRE: Record<number, string> = {
  1:"T1", 2:"T1", 3:"T1",
  4:"T2", 5:"T2", 6:"T2",
  7:"T3", 8:"T3", 9:"T3",
  10:"T4", 11:"T4", 12:"T4",
};

// Carpeta oficial: CARRANZACORTINAINTERIORS SL - COMPARTIDA (Shared Drive gestora)
const GDRIVE_ROOT_CARRANZA  = process.env.GDRIVE_ROOT_CARRANZA  ?? "1bZj_53iRTfh4eYvpVg8b01R27Covvzkf";
const GDRIVE_ROOT_REFORLIFE = process.env.GDRIVE_ROOT_REFORLIFE ?? "";

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

// ─── Buscar carpeta (SOLO busca, NUNCA crea) ─────────────────────────────────
const folderCache = new Map<string, string>();

async function findFolder(drive: any, name: string, parentId: string): Promise<string> {
  const trimmedName = name.trim();
  const cacheKey = `${parentId}/${trimmedName.toLowerCase()}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

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

  if (!match) {
    throw new Error(`Carpeta "${trimmedName}" no encontrada en Google Drive. Pide a la gestora que la cree.`);
  }

  folderCache.set(cacheKey, match.id!);
  return match.id!;
}

// ─── Obtener carpeta destino Ingresos ─────────────────────────────────────────
// Navega: raíz → FACTURAS {año} → T{n} → {actividad} → [subInmueble →] Ingresos
async function getIngresosFolderId(
  drive: any,
  empresa: string,
  fecha: string,
  actividad: string = "REFORMAS",
  subInmueble?: string,
): Promise<string> {
  const [anioStr, mesStr] = fecha.split("-");
  const mes = parseInt(mesStr);
  const trimestre = TRIMESTRE[mes];

  let rootId: string;
  if (empresa === "carranzacortina") {
    if (!GDRIVE_ROOT_CARRANZA) throw new Error("GDRIVE_ROOT_CARRANZA no configurado");
    rootId = GDRIVE_ROOT_CARRANZA;
  } else if (empresa === "reforlife") {
    if (!GDRIVE_ROOT_REFORLIFE) throw new Error("Carpeta Reforlife aún no configurada");
    rootId = GDRIVE_ROOT_REFORLIFE;
  } else {
    throw new Error(`Empresa desconocida: ${empresa}`);
  }

  const facturasId  = await findFolder(drive, `FACTURAS ${anioStr}`, rootId);
  const trimestreId = await findFolder(drive, trimestre, facturasId);
  const actividadId = await findFolder(drive, actividad, trimestreId);

  // FLIPPING HOUSE: nivel extra con el inmueble específico
  if (actividad.toUpperCase() === "FLIPPING HOUSE" && subInmueble) {
    const inmuebleId = await findFolder(drive, subInmueble, actividadId);
    return await findFolder(drive, "Ingresos", inmuebleId);
  }

  return await findFolder(drive, "Ingresos", actividadId);
}

async function dbGet(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "x-api-key": SERVICE_KEY },
  });
  if (!res.ok) throw new Error(`DB error ${res.status}: ${path}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function dbPatch(path: string, body: object) {
  await fetch(`${INSFORGE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-api-secret");
  if (secret !== API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      factura_id,
      fecha_cobro,
      empresa = "carranzacortina",
      actividad = "REFORMAS",
      subInmueble,
      pdfBase64,
    } = await req.json();

    if (!factura_id) {
      return NextResponse.json({ error: "Falta factura_id" }, { status: 400 });
    }

    if (!pdfBase64) {
      return NextResponse.json({ ok: false, error: "Falta el PDF (pdfBase64). El PDF debe generarse en el cliente antes de subir." }, { status: 400 });
    }

    // Obtener la factura de la DB
    const factura = await dbGet(`/api/database/records/facturas?id=eq.${factura_id}`);
    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // La fecha para determinar el trimestre es SIEMPRE la fecha de emisión.
    // Fallback a fecha_cobro si no tiene fecha_emision.
    const fechaParaTrimestre: string =
      (factura.fecha_emision ?? "").split("T")[0]
      || fecha_cobro
      || new Date().toISOString().split("T")[0];

    // Si ya está en Drive, devolver la URL existente
    if (factura.gdrive_url) {
      return NextResponse.json({ ok: true, gdrive_url: factura.gdrive_url, ya_existia: true });
    }

    // Decodificar el PDF base64 enviado desde el cliente
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Obtener carpeta Ingresos del trimestre y actividad correctos
    const drive = getDriveClient();
    folderCache.clear();

    const actividadFinal  = actividad ?? "REFORMAS";
    const subInmuebleFinal = actividadFinal.toUpperCase() === "FLIPPING HOUSE" ? subInmueble : undefined;

    const ingresosFolderId = await getIngresosFolderId(
      drive, empresa, fechaParaTrimestre, actividadFinal, subInmuebleFinal
    );

    const filename = factura.numero_factura
      ? `${factura.numero_factura}.pdf`
      : `factura-${factura_id}.pdf`;

    await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: "application/pdf",
        parents: [ingresosFolderId],
      },
      media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
      fields: "id",
      supportsAllDrives: true,
    });

    // Guardamos la URL de la CARPETA para que el usuario pueda verificar
    const driveUrl = `https://drive.google.com/drive/folders/${ingresosFolderId}`;

    await dbPatch(`/api/database/records/facturas?id=eq.${factura_id}`, { gdrive_url: driveUrl });

    return NextResponse.json({ ok: true, gdrive_url: driveUrl });

  } catch (err: any) {
    console.error("[gdrive/export-ingreso] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
