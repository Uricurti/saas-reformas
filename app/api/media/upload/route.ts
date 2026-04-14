/**
 * POST /api/media/upload
 * Obtiene la estrategia de upload de InsForge usando SERVICE_KEY
 * y la devuelve al cliente para que suba DIRECTAMENTE a S3/R2 sin pasar por Vercel.
 *
 * Flujo:
 *   1. Cliente llama aquí con { path, contentType, size }
 *   2. Este endpoint llama a InsForge con SERVICE_KEY para obtener la presigned URL
 *   3. Devuelve { uploadUrl, fields, confirmUrl, confirmRequired, key }
 *   4. El cliente sube el archivo directamente a uploadUrl (no pasa por Vercel → sin límite 4.5MB)
 *   5. Si confirmRequired, el cliente llama /api/media/confirm con { confirmUrl, size, contentType }
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const BUCKET       = "obras-media";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, contentType, size } = body as {
      path: string;
      contentType: string;
      size: number;
    };

    if (!path || !contentType || size === undefined) {
      return NextResponse.json(
        { error: "path, contentType y size son obligatorios" },
        { status: 400 }
      );
    }

    // Pedir la estrategia de upload a InsForge con SERVICE_KEY
    const strategyRes = await fetch(
      `${INSFORGE_URL}/api/storage/buckets/${BUCKET}/upload-strategy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVICE_KEY,
        },
        body: JSON.stringify({ filename: path, contentType, size }),
      }
    );

    if (!strategyRes.ok) {
      const text = await strategyRes.text().catch(() => strategyRes.statusText);
      console.error("[media/upload] InsForge strategy error:", strategyRes.status, text);
      return NextResponse.json(
        { error: `InsForge error: ${text}` },
        { status: strategyRes.status }
      );
    }

    const strategy = await strategyRes.json();
    // strategy: { method, uploadUrl, fields, key, confirmUrl, confirmRequired, ... }

    return NextResponse.json(strategy);
  } catch (err: any) {
    console.error("[media/upload] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
