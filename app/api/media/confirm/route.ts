/**
 * POST /api/media/confirm
 * Confirma un upload pre-firmado a InsForge Storage.
 * Algunos buckets requieren confirmación después de que el cliente suba el archivo.
 */
import { NextRequest, NextResponse } from "next/server";

const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  try {
    const { confirmUrl, size, contentType } = await req.json();

    if (!confirmUrl) {
      return NextResponse.json({ error: "confirmUrl es obligatorio" }, { status: 400 });
    }

    // InsForge a veces devuelve la confirmUrl como ruta relativa (/api/storage/...)
    // fetch() en Node.js necesita una URL absoluta con dominio
    const fullConfirmUrl = confirmUrl.startsWith("/")
      ? `${INSFORGE_URL}${confirmUrl}`
      : confirmUrl;

    const res = await fetch(fullConfirmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SERVICE_KEY,
      },
      body: JSON.stringify({ size, contentType }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json({ error: `Confirm error: ${text}` }, { status: res.status });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[media/confirm] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
