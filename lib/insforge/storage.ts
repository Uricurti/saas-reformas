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

// ─── URL autenticada para un archivo en Storage ──────────────────────────────
// 3 capas de fallback para máxima compatibilidad con InsForge:
//   1. Signed URL (bucket privado) → URL real que expira en 2h
//   2. Public URL (bucket público) → URL permanente
//   3. Blob URL (descarga autenticada) → siempre funciona, más lento
export async function getMediaUrl(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("blob:")) return pathOrUrl;

  const path = extractStoragePath(pathOrUrl);

  // 1. Signed URL — funciona con buckets privados
  try {
    const bucket = insforge.storage.from(BUCKET) as any;
    const { data, error } = await bucket.createSignedUrl(path, 7200); // 2h
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch { /* SDK puede no soportarlo */ }

  // 2. Public URL — funciona con buckets públicos
  try {
    const result = (insforge.storage.from(BUCKET) as any).getPublicUrl(path);
    if (result?.data?.publicUrl) return result.data.publicUrl;
  } catch { /* no soportado */ }

  // 3. Blob URL — descarga autenticada, siempre funciona
  const ext = path.split(".").pop()?.split("?")[0] ?? "";
  return getStorageBlobUrl(pathOrUrl, `file.${ext}`);
}

/** @deprecated Usa getMediaUrl (async) en su lugar */
export function getPublicStorageUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const path = extractStoragePath(pathOrUrl);
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

// ─── Upload via presigned URL (el archivo va directo a S3/R2, sin pasar por Vercel) ─
// Flujo:
//   1. /api/media/upload devuelve la estrategia de InsForge (presigned URL + campos)
//   2. El cliente sube directamente a esa URL → sin límite de 4.5MB de Vercel
//   3. Si InsForge lo requiere, /api/media/confirm finaliza el upload
async function uploadViaPresigned(
  file: File,
  path: string,
  contentType: string
): Promise<{ storedPath: string | null; error: string | null }> {
  // 1. Obtener estrategia de upload del servidor (con SERVICE_KEY)
  const strategyRes = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, contentType, size: file.size }),
  });
  const strategy = await strategyRes.json().catch(() => ({}));

  if (!strategyRes.ok) {
    return { storedPath: null, error: strategy?.error ?? `Strategy error ${strategyRes.status}` };
  }

  // 2. Subir directamente a la URL de S3/R2 (no pasa por Vercel)
  const form = new FormData();
  if (strategy.fields && typeof strategy.fields === "object") {
    Object.entries(strategy.fields as Record<string, string>).forEach(([k, v]) => {
      form.append(k, v);
    });
  }
  // Crear Blob con el Content-Type correcto
  const blob = new Blob([await file.arrayBuffer()], { type: contentType });
  form.append("file", blob, path.split("/").pop() ?? "file");

  const uploadRes = await fetch(strategy.uploadUrl, {
    method: "POST",
    body: form,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => uploadRes.statusText);
    return { storedPath: null, error: `Upload error ${uploadRes.status}: ${text}` };
  }

  // 3. Confirmar si InsForge lo requiere
  if (strategy.confirmRequired && strategy.confirmUrl) {
    const confirmRes = await fetch("/api/media/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUrl: strategy.confirmUrl, size: file.size, contentType }),
    });
    if (!confirmRes.ok) {
      const j = await confirmRes.json().catch(() => ({}));
      return { storedPath: null, error: j?.error ?? "Confirm error" };
    }
    const confirmed = await confirmRes.json().catch(() => ({}));
    const storedPath = confirmed?.key ?? strategy.key ?? path;
    return { storedPath, error: null };
  }

  return { storedPath: strategy.key ?? path, error: null };
}

// ─── Subir foto ──────────────────────────────────────────────────────────────
export async function subirFoto(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  const comprimido = await comprimirFoto(file);
  const path = `${tenantId}/${obraId}/${userId}/${Date.now()}.webp`;

  const { storedPath, error } = await uploadViaPresigned(comprimido, path, "image/webp");
  if (error || !storedPath) {
    return { url: null, error: error ?? "Error al subir", tamano: 0 };
  }
  return { url: storedPath, error: null, tamano: comprimido.size };
}

// ─── Comprimir vídeo con ffmpeg.wasm ────────────────────────────────────────
// Se carga el core de ffmpeg desde CDN la primera vez (~30 MB, queda cacheado).
// REQUIERE SharedArrayBuffer — disponible en navegadores modernos con
// cabeceras de aislamiento cross-origin. En iOS Safari sin esas cabeceras
// NO está disponible y la compresión fallará.
let _ffmpegInstance: any = null;

export async function comprimirVideo(
  file: File,
  onProgress?: (etapa: string, pct: number) => void
): Promise<File> {
  // Detección temprana: si SharedArrayBuffer no está disponible significa que las
  // cabeceras de aislamiento cross-origin (COOP/COEP) no se están aplicando correctamente
  // → ffmpeg.wasm no puede arrancar. Fallamos rápido con error descriptivo.
  if (typeof SharedArrayBuffer === "undefined") {
    throw new Error(
      "SharedArrayBuffer no disponible — las cabeceras COOP/COEP no están activas. " +
      "Comprueba que next.config.mjs envía Cross-Origin-Opener-Policy y Cross-Origin-Embedder-Policy."
    );
  }

  onProgress?.("Cargando compresor…", 0);

  if (!_ffmpegInstance) {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    _ffmpegInstance = new FFmpeg();
  }
  const ffmpeg = _ffmpegInstance;

  if (!ffmpeg.loaded) {
    // Cargamos desde nuestro propio servidor (public/ffmpeg/) en vez del CDN.
    // Ventajas:
    //   - Sin problemas de CORS ni fallos de CDN → funciona en iOS Safari
    //   - El .wasm se sirve con Content-Type correcto (application/wasm)
    //   - Al ser mismo origen, no necesitamos toBlobURL
    //   - Cacheado 1 año en el browser → solo se descarga una vez (~31 MB)
    await ffmpeg.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });
  }

  onProgress?.("Preparando vídeo…", 5);
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile("input", await fetchFile(file));

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.("Comprimiendo vídeo…", Math.round(5 + progress * 90));
  };
  ffmpeg.on("progress", progressHandler);

  // 720p máx, H.264, CRF 28 ≈ 15-20 MB/min · faststart para reproducción web
  await ffmpeg.exec([
    "-i", "input",
    "-vf", "scale=-2:min(720\\,ih)",   // no upscale si ya es <720p
    "-c:v", "libx264",
    "-crf", "28",
    "-preset", "fast",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "96k",
    "output.mp4",
  ]);

  ffmpeg.off("progress", progressHandler);
  onProgress?.("Finalizando…", 97);

  const data = await ffmpeg.readFile("output.mp4") as Uint8Array;
  await ffmpeg.deleteFile("input");
  await ffmpeg.deleteFile("output.mp4");

  return new File([data], "video_comprimido.mp4", { type: "video/mp4" });
}

// Límite máximo de subida cuando NO hay compresión disponible (iOS sin SharedArrayBuffer).
// El bucket de InsForge tiene un límite de ~50 MB; usamos 40 MB como margen de seguridad.
const MAX_VIDEO_SIN_COMPRESION_MB = 40;

// ─── Subir vídeo (comprime SIEMPRE para ahorrar espacio en storage) ─────────
export async function subirVideo(
  file: File,
  tenantId: string,
  obraId: string,
  userId: string,
  onProgress?: (etapa: string, pct: number) => void
): Promise<{ url: string | null; error: string | null; tamano: number }> {
  let videoFile = file;
  let compressionFailed = false;

  // INTENTO 1: Comprimir en cliente (rápido, funciona en desktop/Android)
  // En iOS Safari (sin SharedArrayBuffer) ffmpeg no puede arrancar y lanza error.
  try {
    videoFile = await comprimirVideo(file, onProgress);
    console.log("[storage] Compresión cliente exitosa:", file.name);
  } catch (e) {
    compressionFailed = true;
    console.warn("[storage] Compresión cliente falló, intentando servidor:", file.name, e);
  }

  // Si la compresión en cliente falló, intentar con servidor como fallback
  if (compressionFailed) {
    const mb = videoFile.size / (1024 * 1024);

    // Si el vídeo ya supera 50MB sin comprimir, ir directo a servidor
    if (mb > 50) {
      onProgress?.("Comprimiendo en servidor…", 50);
      console.log(`[storage] Vídeo ${mb.toFixed(1)} MB > 50MB, usando compresión servidor`);

      try {
        const form = new FormData();
        form.append("video", file);
        form.append("tenantId", tenantId);
        form.append("obraId", obraId);
        form.append("userId", userId);

        const res = await fetch("/api/media/compress-and-upload", {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? `Error ${res.status}`);
        }

        const result = await res.json();
        onProgress?.("Finalizado…", 100);
        return {
          url: result.url,
          error: null,
          tamano: result.tamano,
        };
      } catch (serverError: any) {
        const errorMsg = serverError?.message ?? "Error en compresión servidor";
        console.error("[storage] Compresión servidor falló:", errorMsg);
        return {
          url: null,
          error: `Compresión fallida: ${errorMsg}. Intenta con un vídeo más corto o baja la resolución.`,
          tamano: 0,
        };
      }
    }

    // Si está entre 40-50MB sin comprimir, ofrecer opción clara
    if (mb > MAX_VIDEO_SIN_COMPRESION_MB) {
      const mbRedondeado = Math.round(mb);
      return {
        url: null,
        error: `El vídeo pesa ${mbRedondeado} MB sin poder comprimirse en tu dispositivo. Opciones:\n1. Graba un clip más corto\n2. Baja la calidad en Ajustes → Cámara → Grabar vídeo\n3. Usa otro dispositivo (Android, desktop)`,
        tamano: 0,
      };
    }

    // Si está entre 30-40MB sin comprimir, intentar subir como está (riesgo calculado)
    console.warn(`[storage] Subiendo vídeo sin comprimir (${mb.toFixed(1)} MB):`, file.name);
    videoFile = file;
  }

  onProgress?.("Subiendo vídeo…", 98);
  // Siempre .mp4 — el cliente crea un Blob con type video/mp4
  const path = `${tenantId}/${obraId}/${userId}/${Date.now()}.mp4`;

  const { storedPath, error } = await uploadViaPresigned(videoFile, path, "video/mp4");
  if (error || !storedPath) {
    return { url: null, error: error ?? "Error al subir vídeo", tamano: 0 };
  }
  return { url: storedPath, error: null, tamano: videoFile.size };
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

  const contentType = file.type || "application/octet-stream";
  const { storedPath, error } = await uploadViaPresigned(file, path, contentType);
  if (error || !storedPath) {
    return { url: null, error: error ?? "Error al subir documento", tamano: 0 };
  }
  return { url: storedPath, error: null, tamano: file.size };
}

// ─── Límites de tamaño ───────────────────────────────────────────────────────
export const MAX_DOC_MB  = 50;
export const MAX_FOTO_MB = 10;
export const MAX_VIDEO_MB     = 500; // límite absoluto (Android/desktop, con compresión)
export const MAX_VIDEO_IOS_MB = 40;  // en iOS no hay compresión → límite = techo del bucket

export function validarDocumento(file: File): string | null {
  const mb  = file.size / (1024 * 1024);
  if (mb > MAX_DOC_MB) return `El archivo supera el límite de ${MAX_DOC_MB} MB`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const permitidos = ["pdf", "png", "jpg", "jpeg", "webp", "svg", "dwg", "dxf", "doc", "docx", "xls", "xlsx"];
  if (!permitidos.includes(ext)) return `Formato no permitido (.${ext})`;
  return null;
}

// Detecta iOS (todos los browsers en iPhone/iPad usan WebKit con las mismas limitaciones)
function esIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function validarTamanoArchivo(file: File): string | null {
  const mb = file.size / (1024 * 1024);
  if (file.type.startsWith("video/")) {
    // En iOS no podemos comprimir → aplicar límite más estricto
    if (esIOS() && mb > MAX_VIDEO_IOS_MB) {
      return `El vídeo pesa ${Math.round(mb)} MB. En iPhone la compresión automática no está disponible, así que el límite es ${MAX_VIDEO_IOS_MB} MB. Graba un clip más corto o baja la resolución en Ajustes → Cámara → Grabar vídeo.`;
    }
    if (mb > MAX_VIDEO_MB) {
      return `El vídeo supera el límite de ${MAX_VIDEO_MB} MB`;
    }
  } else if (mb > MAX_FOTO_MB) {
    return `La foto supera el límite de ${MAX_FOTO_MB} MB`;
  }
  return null;
}
