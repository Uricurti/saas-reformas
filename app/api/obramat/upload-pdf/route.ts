/**
 * POST /api/obramat/upload-pdf
 *
 * Recibe un PDF en base64 desde el bookmarklet de Obramat y lo sube
 * a InsForge Storage. Devuelve la URL permanente del PDF.
 *
 * Usado desde el bookmarklet (cross-origin desde obramat.es) — CORS habilitado.
 *
 * Body: { base64: string, filename: string, tenantId?: string, size: number }
 * Response: { pdf_url: string }
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const API_SECRET   = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();
const BUCKET       = "obras-media";
const DEFAULT_TENANT_ID = "e1154609-b397-421b-a12e-710d628886c9";

// ─── CORS para llamadas desde obramat.es ────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "https://www.obramat.es",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-secret",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const secret = req.headers.get("x-api-secret");
    if (secret !== API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const body = await req.json();
    const { base64, filename, tenantId: rawTenantId, size } = body as {
      base64:    string;
      filename:  string;
      tenantId?: string;
      size:      number;
    };

    if (!base64 || !filename || !size) {
      return NextResponse.json(
        { error: "base64, filename y size son obligatorios" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const tenantId = rawTenantId ?? DEFAULT_TENANT_ID;

    // ── Decodificar PDF ─────────────────────────────────────────────────────
    const buffer = Buffer.from(base64, "base64");

    // ── Ruta de storage ─────────────────────────────────────────────────────
    // gastos/{tenantId}/{timestamp}_{filename}.pdf
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
    const storagePath = `gastos/${tenantId}/${Date.now()}_${safeName}`;
    const contentType = "application/pdf";

    // ── Obtener presigned URL de InsForge ───────────────────────────────────
    const strategyRes = await fetch(
      `${INSFORGE_URL}/api/storage/buckets/${BUCKET}/upload-strategy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body: JSON.stringify({ filename: storagePath, contentType, size: buffer.length }),
      }
    );

    if (!strategyRes.ok) {
      const text = await strategyRes.text().catch(() => strategyRes.statusText);
      return NextResponse.json(
        { error: `InsForge strategy error: ${text}` },
        { status: strategyRes.status, headers: CORS_HEADERS }
      );
    }

    const strategy = await strategyRes.json();
    // strategy: { uploadUrl, fields, key, confirmUrl, confirmRequired, method }

    // ── Subir a S3/R2 via presigned URL ─────────────────────────────────────
    const form = new FormData();
    if (strategy.fields && typeof strategy.fields === "object") {
      for (const [k, v] of Object.entries(strategy.fields as Record<string, string>)) {
        form.append(k, v);
      }
    }
    const blob = new Blob([buffer], { type: contentType });
    form.append("file", blob, storagePath.split("/").pop() ?? "invoice.pdf");

    const uploadRes = await fetch(strategy.uploadUrl, { method: "POST", body: form });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => uploadRes.statusText);
      return NextResponse.json(
        { error: `Upload error ${uploadRes.status}: ${text}` },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    // ── Confirmar si InsForge lo requiere ───────────────────────────────────
    if (strategy.confirmRequired && strategy.confirmUrl) {
      const fullConfirmUrl = strategy.confirmUrl.startsWith("/")
        ? `${INSFORGE_URL}${strategy.confirmUrl}`
        : strategy.confirmUrl;

      await fetch(fullConfirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body: JSON.stringify({ size: buffer.length, contentType }),
      });
    }

    const pdfUrl = strategy.key ?? storagePath;

    return NextResponse.json(
      { pdf_url: pdfUrl, size: buffer.length },
      { headers: CORS_HEADERS }
    );

  } catch (err: any) {
    console.error("[obramat/upload-pdf] Error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
