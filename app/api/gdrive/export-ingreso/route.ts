/**
 * POST /api/gdrive/export-ingreso
 *
 * Se llama automáticamente cuando un pago se marca como "cobrado".
 * Sube el PDF de la factura a la carpeta de Ingresos en Drive.
 *
 * Estructura: {empresa} / facturas {año} / T{1-4} / Ingresos /
 *
 * Body: {
 *   factura_id: string,        // ID de la factura en la DB
 *   fecha_cobro: string,       // "2026-05-15" → determina trimestre
 *   empresa?: string           // "carranzacortina" | "reforlife"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const API_SECRET   = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();
const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

const TRIMESTRE: Record<number, string> = {
  1:"T1", 2:"T1", 3:"T1",
  4:"T2", 5:"T2", 6:"T2",
  7:"T3", 8:"T3", 9:"T3",
  10:"T4", 11:"T4", 12:"T4",
};

const GDRIVE_ROOT_CARRANZA  = process.env.GDRIVE_ROOT_CARRANZA  ?? "105BCJ0gtsNGExG-U2vLjkO9X1MSnQzXT";
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

async function getIngresosFolderId(drive: any, empresa: string, fecha: string): Promise<string> {
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

  const facturasId  = await getOrCreateFolder(drive, `facturas ${anioStr}`, rootId);
  const trimestreId = await getOrCreateFolder(drive, trimestre, facturasId);
  return await getOrCreateFolder(drive, "Ingresos", trimestreId);
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
    const { factura_id, fecha_cobro, empresa = "carranzacortina" } = await req.json();

    if (!factura_id || !fecha_cobro) {
      return NextResponse.json({ error: "Faltan factura_id o fecha_cobro" }, { status: 400 });
    }

    // Obtener la factura de la DB
    const factura = await dbGet(`/api/database/records/facturas?id=eq.${factura_id}`);
    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Si ya está en Drive, devolver la URL existente
    if (factura.gdrive_url) {
      return NextResponse.json({ ok: true, gdrive_url: factura.gdrive_url, ya_existia: true });
    }

    // Necesitamos el PDF — archivo_url puede ser key de storage o URL
    if (!factura.archivo_url) {
      return NextResponse.json({ ok: false, error: "La factura no tiene PDF generado aún" }, { status: 422 });
    }

    // Descargar PDF desde InsForge Storage
    let pdfUrl = factura.archivo_url as string;
    if (!pdfUrl.startsWith("http")) {
      const res = await fetch(
        `${INSFORGE_URL}/api/storage/buckets/obras-media/objects/${encodeURIComponent(pdfUrl)}`,
        { headers: { "x-api-key": SERVICE_KEY } }
      );
      if (!res.ok) throw new Error(`No se pudo obtener URL del PDF: ${res.status}`);
      const data = await res.json();
      pdfUrl = data.signedUrl ?? data.url ?? pdfUrl;
    }

    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) throw new Error(`No se pudo descargar el PDF: ${pdfRes.status}`);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    // Obtener carpeta Ingresos del trimestre correcto
    const drive = getDriveClient();
    folderCache.clear();
    const ingresosFolderId = await getIngresosFolderId(drive, empresa, fecha_cobro);

    // Nombre del archivo: número de factura o ID
    const filename = factura.numero_factura
      ? `${factura.numero_factura}.pdf`
      : `factura-${factura_id}.pdf`;

    // Subir a Drive
    const { Readable } = await import("stream");
    const uploaded = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: "application/pdf",
        parents: [ingresosFolderId],
      },
      media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    const driveUrl = uploaded.data.webViewLink
      ?? `https://drive.google.com/file/d/${uploaded.data.id}/view`;

    // Guardar gdrive_url en la DB
    await dbPatch(`/api/database/records/facturas?id=eq.${factura_id}`, { gdrive_url: driveUrl });

    return NextResponse.json({ ok: true, gdrive_url: driveUrl });

  } catch (err: any) {
    console.error("[gdrive/export-ingreso] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
