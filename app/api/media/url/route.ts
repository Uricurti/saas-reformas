/**
 * GET /api/media/url?path=xxx
 * Genera una URL firmada server-side usando SERVICE_KEY.
 * Así evitamos todos los problemas de CORS y autenticación en el cliente móvil.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const BUCKET       = "obras-media";
const EXPIRES_IN   = 3600; // 1 hora

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("path");
  if (!raw) return NextResponse.json({ error: "path requerido" }, { status: 400 });

  const path = decodeURIComponent(raw);
  const base = INSFORGE_URL.replace(/\/$/, "");

  // 1. Signed URL via API de InsForge/Supabase-compatible
  //    Intentamos ambas variantes de auth header que usa InsForge
  const signEndpoints = [
    `${base}/storage/v1/object/sign/${BUCKET}/${path}`,
    `${base}/api/storage/buckets/${BUCKET}/objects/sign/${path}`,
  ];

  for (const endpoint of signEndpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "x-api-key": SERVICE_KEY,
        },
        body: JSON.stringify({ expiresIn: EXPIRES_IN }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const signed = data.signedURL ?? data.signedUrl ?? data.url ?? null;
        if (signed) {
          const url = signed.startsWith("http") ? signed : `${base}${signed}`;
          return NextResponse.json({ url }, {
            headers: { "Cache-Control": `public, max-age=${EXPIRES_IN - 60}` },
          });
        }
      }
    } catch { /* prueba siguiente variante */ }
  }

  // 2. Public URL como fallback (funciona si el bucket es público)
  const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${path}`;
  return NextResponse.json({ url: publicUrl }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
