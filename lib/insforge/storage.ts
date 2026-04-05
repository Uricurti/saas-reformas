import insforge from "./client";
import imageCompression from "browser-image-compression";

const BUCKET = "obras-media";

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
    return file; // si falla la compresión, subir el original
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
  const ext = "webp";
  const nombre = `${tenantId}/${obraId}/${userId}/${Date.now()}.${ext}`;

  const { data, error } = await insforge.storage
    .from(BUCKET)
    .upload(nombre, comprimido);

  if (error || !data) {
    return { url: null, error: (error as any)?.message ?? "Error al subir", tamano: 0 };
  }

  // Obtener URL pública (InsForge Storage devuelve la URL del archivo)
  const url = (data as any).url ?? (data as any).path ?? nombre;

  return { url, error: null, tamano: comprimido.size };
}

// ─── Subir vídeo (sin compresión en MVP) ────────────────────────────────────
export async function subirVideo(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  const ext = file.name.split(".").pop() ?? "mp4";
  const nombre = `${tenantId}/${obraId}/${userId}/${Date.now()}.${ext}`;

  const { data, error } = await insforge.storage
    .from(BUCKET)
    .upload(nombre, file);

  if (error || !data) {
    return { url: null, error: (error as any)?.message ?? "Error al subir vídeo", tamano: 0 };
  }

  const url = (data as any).url ?? (data as any).path ?? nombre;
  return { url, error: null, tamano: file.size };
}

// ─── Eliminar archivo ────────────────────────────────────────────────────────
export async function eliminarArchivo(path: string) {
  return insforge.storage.from(BUCKET).download(path); // placeholder — adaptar con delete cuando esté en SDK
}

// ─── Helper: detectar tipo de archivo ────────────────────────────────────────
export function detectarTipoArchivo(file: File): "foto" | "video" {
  return file.type.startsWith("video/") ? "video" : "foto";
}

// ─── Subir documento (PDF, plano, imagen, etc.) ──────────────────────────────
const BUCKET_DOCS = "obras-docs";

export async function subirDocumento(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  const ext = file.name.split(".").pop() ?? "bin";
  const nombre = `${tenantId}/${obraId}/${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { data, error } = await insforge.storage
    .from(BUCKET_DOCS)
    .upload(nombre, file);

  if (error || !data) {
    return { url: null, error: (error as any)?.message ?? "Error al subir", tamano: 0 };
  }

  const url = (data as any).url ?? (data as any).path ?? nombre;
  return { url, error: null, tamano: file.size };
}

export const MAX_DOC_MB = 50;

export function validarDocumento(file: File): string | null {
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_DOC_MB) return `El archivo supera el límite de ${MAX_DOC_MB} MB`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const permitidos = ["pdf", "png", "jpg", "jpeg", "webp", "svg", "dwg", "dxf", "doc", "docx", "xls", "xlsx"];
  if (!permitidos.includes(ext)) return `Formato no permitido (.${ext})`;
  return null;
}

// ─── Límite de tamaño ────────────────────────────────────────────────────────
export const MAX_FOTO_MB = 10;
export const MAX_VIDEO_MB = 100;

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
