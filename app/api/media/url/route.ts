/**
 * GET /api/media/url?path=xxx
 * Devuelve la URL de descarga correcta para InsForge Storage.
 * El bucket "obras-media" es público → URL directa sin firma.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const BUCKET       = "obras-media";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("path");
  if (!raw) return NextResponse.json({ error: "path requerido" }, { status: 400 });

  const path = decodeURIComponent(raw).replace(/^\/+/, ""); // quitar slashes iniciales

  // InsForge Storage: GET /api/storage/buckets/{bucket}/objects/{encodedKey}
  // El path completo va URL-encoded (los / se convierten en %2F)
  const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
  const url = `${INSFORGE_URL}/api/storage/buckets/${BUCKET}/objects/${encodedPath}`;

  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
