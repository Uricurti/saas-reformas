/**
 * POST /api/media/upload
 * Proxy de upload a InsForge Storage usando SERVICE_KEY.
 * Recibe el archivo como FormData y lo sube al bucket "obras-media".
 * Necesario porque el SDK de cliente falla con ciertos Content-Types
 * (ej. video/quicktime de iOS) y porque el bucket requiere SERVICE_KEY para escritura.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const BUCKET       = "obras-media";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file        = form.get("file") as File | null;
    const storagePath = form.get("path") as string | null;

    if (!file || !storagePath) {
      return NextResponse.json({ error: "file y path son obligatorios" }, { status: 400 });
    }

    // Normalizar el Content-Type: forzar mp4 para cualquier vídeo
    const rawType    = file.type || "application/octet-stream";
    const isVideo    = rawType.startsWith("video/") || storagePath.match(/\.(mov|mp4|avi|mkv|webm)$/i);
    const contentType = isVideo ? "video/mp4" : rawType;

    // Normalizar la extensión del path para que coincida con el Content-Type
    const normalizedPath = isVideo
      ? storagePath.replace(/\.[^.]+$/, ".mp4")
      : storagePath;

    // Construir la URL de InsForge Storage
    // Endpoint: PUT /api/storage/buckets/{bucket}/objects/{encodedPath}
    const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("/");
    const url = `${INSFORGE_URL}/api/storage/buckets/${BUCKET}/objects/${encodedPath}`;

    // Convertir el File a ArrayBuffer para enviarlo raw
    const buffer = await file.arrayBuffer();

    const upstream = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-api-key":    SERVICE_KEY,
        "x-upsert":     "false",
      },
      body: buffer,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => upstream.statusText);
      // Si ya existe el objeto (409), intentar con upsert
      if (upstream.status === 409) {
        const upsertRes = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-api-key":    SERVICE_KEY,
            "x-upsert":     "true",
          },
          body: buffer,
        });
        if (!upsertRes.ok) {
          const upsertText = await upsertRes.text().catch(() => upsertRes.statusText);
          return NextResponse.json({ error: `Storage error: ${upsertText}` }, { status: upsertRes.status });
        }
        return NextResponse.json({ path: normalizedPath });
      }
      return NextResponse.json({ error: `Storage error: ${text}` }, { status: upstream.status });
    }

    return NextResponse.json({ path: normalizedPath });
  } catch (err: any) {
    console.error("[media/upload] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}

// Necesario para que Next.js acepte bodies grandes (vídeos)
export const maxDuration = 60; // segundos máx por request en Vercel
