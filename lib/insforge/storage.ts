import insforge from "./client";
import imageCompression from "browser-image-compression";

const BUCKET = "obras-media";

// ─── Helper: extraer path relativo de una URL de InsForge Storage ────────────
// La URL puede ser:
//   https://xxx.insforge.app/api/storage/buckets/obras-media/objects/docs%2F...
// o directamente un path relativo: docs/tenant/obra/user/file.pdf
export function extractStoragePath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) return urlOrPath; // ya es un path
  // Extraer todo lo que va después de /objects/
  const match = urlOrPath.match(/\/objects\/(.+?)(\?|$)/);
  if (match) return decodeURIComponent(match[1]);
  return urlOrPath;
}

// Mapa de extensiones → MIME type correcto
const MIME_TYPES: Record<string, string> = {
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif:  "image/gif",
  svg:  "image/svg+xml",
  dwg:  "application/acad",
  dxf:  "application/dxf",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ─── Obtener blob URL con el MIME type correcto ───────────────────────────────
// InsForge devuelve el blob como application/octet-stream (genérico).
// Forzamos el tipo correcto a partir del nombre del fichero para que el
// navegador sepa renderizarlo en vez de descargarlo.
export async function getStorageBlobUrl(
  storedUrl: string,
  fileName: string = ""
): Promise<string | null> {
  try {
    const path = extractStoragePath(storedUrl);
    const { data, error } = await insforge.storage.from(BUCKET).download(path);
    if (error || !data) return null;

    // Detectar MIME type por extensión del nombre del fichero
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_TYPES[ext] ?? data.type ?? "application/octet-stream";

    // Re-crear el blob con el tipo correcto (el SDK lo devuelve como octet-stream)
    const typedBlob = new Blob([await data.arrayBuffer()], { type: mimeType });
    return URL.createObjectURL(typedBlob);
  } catch {
    return null;
  }
}

// ─── URL pública de un archivo en Storage ────────────────────────────────────
// InsForge (Supabase-compatible) construye URLs públicas con este patrón.
// Si el bucket es privado, usar getStorageBlobUrl en su lugar.
export function getPublicStorageUrl(pathOrUrl: string): string {
  // Si ya es una URL completa, devolverla tal cual
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const path = extractStoragePath(pathOrUrl);
  // Intentar mediante SDK (Supabase-compatible: getPublicUrl)
  try {
    const result = (insforge.storage.from(BUCKET) as any).getPublicUrl(path);
    if (result?.data?.publicUrl) return result.data.publicUrl;
  } catch { /* SDK puede no tener getPublicUrl */ }
  // Fallback: construir la URL manualmente usando la base de InsForge
  const base = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─── Comprimir foto antes de subir ──────────────────────────────────────────
async function comprimirFoto(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
    onProgress: undefined,
  };
  try {
    return await imageCompression(file, options);
  } catch {
    return file;
  }
}

// ─── Subir foto ──────────────────────────────────────────────────────────────
export async function subirFoto(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  const comprimido = await comprimirFoto(file);
  const ext    = "webp";
  const path   = `${tenantId}/${obraId}/${userId}/${Date.now()}.${ext}`;

  const { data, error } = await insforge.storage.from(BUCKET).upload(path, comprimido);
  if (error || !data) {
    return { url: null, error: (error as any)?.message ?? "Error al subir", tamano: 0 };
  }

  // La doc de InsForge dice: usa siempre el "key" que devuelve el upload
  // (no el path que enviaste — puede haberse renombrado si había duplicado)
  const storedPath = (data as any).key ?? (data as any).path ?? path;
  return { url: storedPath, error: null, tamano: comprimido.size };
}

// ─── Subir vídeo (sin compresión en MVP) ────────────────────────────────────
export async function subirVideo(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  const ext  = file.name.split(".").pop() ?? "mp4";
  const path = `${tenantId}/${obraId}/${userId}/${Date.now()}.${ext}`;

  const { data, error } = await insforge.storage.from(BUCKET).upload(path, file);
  if (error || !data) {
    return { url: null, error: (error as any)?.message ?? "Error al subir vídeo", tamano: 0 };
  }

  const storedPath = (data as any).key ?? (data as any).path ?? path;
  return { url: storedPath, error: null, tamano: file.size };
}

// ─── Eliminar archivo ────────────────────────────────────────────────────────
export async function eliminarArchivo(storedUrl: string) {
  const path = extractStoragePath(storedUrl);
  return insforge.storage.from(BUCKET).remove(path as any);
}

// ─── Helper: detectar tipo de archivo ────────────────────────────────────────
export function detectarTipoArchivo(file: File): "foto" | "video" {
  return file.type.startsWith("video/") ? "video" : "foto";
}

// ─── Subir documento (PDF, plano, imagen, etc.) ──────────────────────────────
export async function subirDocumento(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  const nombreSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `docs/${tenantId}/${obraId}/${userId}/${Date.now()}_${nombreSeguro}`;

  const { data, error } = await insforge.storage.from(BUCKET).upload(path, file);
  if (error || !data) {
    return { url: null, error: (error as any)?.message ?? "Error al subir documento", tamano: 0 };
  }

  // Guardar el key que devuelve InsForge (puede diferir del path enviado si hay duplicado)
  const storedPath = (data as any).key ?? (data as any).path ?? path;
  return { url: storedPath, error: null, tamano: file.size };
}

// ─── Límites de tamaño ───────────────────────────────────────────────────────
export const MAX_DOC_MB  = 50;
export const MAX_FOTO_MB = 10;
export const MAX_VIDEO_MB = 100;

export function validarDocumento(file: File): string | null {
  const mb  = file.size / (1024 * 1024);
  if (mb > MAX_DOC_MB) return `El archivo supera el límite de ${MAX_DOC_MB} MB`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const permitidos = ["pdf", "png", "jpg", "jpeg", "webp", "svg", "dwg", "dxf", "doc", "docx", "xls", "xlsx"];
  if (!permitidos.includes(ext)) return `Formato no permitido (.${ext})`;
  return null;
}

export function validarTamanoArchivo(file: File): string | null {
  const mb = file.size / (1024 * 1024);
  if (file.type.startsWith("video/") && mb > MAX_VIDEO_MB) {
    return `El vídeo supera el límite de ${MAX_VIDEO_MB} MB`;
  }
  if (!file.type.startsWith("video/") && mb > MAX_FOTO_MB) {
    return `La foto supera el límite de ${MAX_FOTO_MB} MB`;
  }
  return null;
}
