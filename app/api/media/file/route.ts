/**
 * GET /api/media/file?path=xxx
 * Proxy server-side que descarga el archivo de InsForge Storage y lo sirve
 * al browser con el Content-Type correcto.
 *
 * Ventajas vs. devolver la URL directa:
 *   - Sin problemas de CORS (la petición sale del servidor, no del browser)
 *   - Funciona aunque el bucket no sea 100% público
 *   - Soporta Range requests para streaming de vídeo
 */
import { NextRequest } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const BUCKET       = "obras-media";

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  mp4:  "video/mp4",
  mov:  "video/quicktime",
  webm: "video/webm",
  pdf:  "application/pdf",
};

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("path");
  if (!raw) return new Response("path requerido", { status: 400 });

  const path        = decodeURIComponent(raw).replace(/^\/+/, "");
  const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
  const url         = `${INSFORGE_URL}/api/storage/buckets/${BUCKET}/objects/${encodedPath}`;

  const ext         = path.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  try {
    // Pasar el header Range si viene (necesario para reproducción de vídeo)
    const upstreamHeaders: HeadersInit = { "x-api-key": SERVICE_KEY };
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

    const upstream = await fetch(url, {
      headers: upstreamHeaders,
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      console.error(`[media/file] InsForge ${upstream.status} para path: ${path}`);
      return new Response("Archivo no encontrado", { status: 404 });
    }

    const responseHeaders = new Headers({
      "Content-Type":  contentType,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    });

    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");
    if (cl) responseHeaders.set("Content-Length", cl);
    if (cr) responseHeaders.set("Content-Range", cr);

    return new Response(upstream.body, {
      status:  upstream.status, // 200 o 206 (partial)
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("[media/file] Error:", err);
    return new Response("Error interno", { status: 500 });
  }
}
