/**
 * POST /api/obramat/sync
 *
 * Recibe las facturas extraídas por el bookmarklet del portal de Obramat
 * y las guarda en la tabla `gastos`.
 *
 * Body esperado (desde el bookmarklet):
 * {
 *   mes:      number,       // 1-12
 *   anio:     number,       // 2026
 *   facturas: Array<{
 *     fecha:   string,      // "5 may 2026"
 *     numero:  string,      // "034-0005-380819"
 *     tienda:  string,      // "Obramat Sabadell"
 *     importe: number,      // importe total IVA incluido
 *     mes:     number,
 *     anio:    number,
 *   }>,
 *   tenantId?: string,      // opcional — si no se envía usa el hardcoded
 * }
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const API_SECRET   = (process.env.OBRAMAT_API_SECRET ?? "obramat-sync-2026-secret").trim();

// CORS para llamadas cross-origin desde el bookmarklet (obramat.es)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "https://www.obramat.es",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-secret",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Tenant por defecto (Reformas Principal)
const DEFAULT_TENANT_ID = "e1154609-b397-421b-a12e-710d628886c9";

async function dbAdmin(path: string, method = "GET", body?: object) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /**/ }
  if (!res.ok) return { data: null, error: data?.message ?? `HTTP ${res.status}` };
  return { data, error: null };
}

function toIsoDate(str: string): string | null {
  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const m = str.trim().match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (!m) return null;
  const mesIdx = MESES.findIndex(x => x === m[2].toLowerCase().slice(0, 3));
  if (mesIdx === -1) return null;
  return `${m[3]}-${String(mesIdx + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    // ── Autenticación ────────────────────────────────────────────────────────
    const secret = req.headers.get("x-api-secret");
    if (secret !== API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const body = await req.json();
    const { mes, anio, facturas, tenantId: rawTenantId } = body;

    if (!mes || !anio || !Array.isArray(facturas)) {
      return NextResponse.json(
        { error: "Body inválido. Requiere: mes, anio, facturas[]" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const tenantId = rawTenantId ?? DEFAULT_TENANT_ID;

    // ── Obtener existentes (para deduplicar y actualizar pdf_url) ───────────
    const { data: existentes } = await dbAdmin(
      `/api/database/records/gastos?tenant_id=eq.${tenantId}&origen=eq.obramat&anio=eq.${anio}&mes=eq.${mes}`
    );
    // Mapa numero_factura → { id, pdf_url }
    const existentesMap = new Map<string, { id: string; pdf_url: string | null }>(
      (existentes ?? [])
        .filter((g: any) => g.numero_factura)
        .map((g: any) => [g.numero_factura as string, { id: g.id, pdf_url: g.pdf_url ?? null }])
    );

    // ── Insertar nuevas / actualizar pdf_url de existentes ───────────────────
    let insertadas = 0;
    let actualizadas = 0;
    let duplicadas = 0;
    const errores: string[] = [];

    for (const f of facturas) {
      const numero = f.numero ?? f.numero_factura ?? "";
      if (!numero) continue;

      // Si la factura ya existe, actualizar solo el pdf_url si viene y no tenía
      if (existentesMap.has(numero)) {
        const existing = existentesMap.get(numero)!;
        if (f.pdf_url && !existing.pdf_url) {
          // Actualizar pdf_url
          await dbAdmin(
            `/api/database/records/gastos?id=eq.${existing.id}`,
            "PATCH",
            { pdf_url: f.pdf_url }
          );
          actualizadas++;
        } else {
          duplicadas++;
        }
        continue;
      }

      const total    = Number(f.importe ?? f.importe_total ?? 0);
      const base     = Math.round((total / 1.21) * 100) / 100;
      const ivaAmt   = Math.round((total - base) * 100) / 100;
      const fechaIso = toIsoDate(f.fecha) ?? f.fecha_factura ?? `${anio}-${String(mes).padStart(2,"0")}-01`;
      const concepto = f.tienda
        ? `Materiales construcción — ${f.tienda}`
        : (f.concepto ?? "Materiales Obramat");

      const { error } = await dbAdmin("/api/database/records/gastos", "POST", {
        tenant_id:       tenantId,
        numero_factura:  numero,
        proveedor:       "Obramat",
        fecha_factura:   fechaIso,
        concepto,
        importe_base:    base,
        porcentaje_iva:  21,
        importe_iva:     ivaAmt,
        importe_total:   total,
        origen:          "obramat",
        mes,
        anio,
        ...(f.pdf_url ? { pdf_url: f.pdf_url } : {}),
      });

      if (error) {
        errores.push(`${numero}: ${error}`);
      } else {
        insertadas++;
        existentesMap.set(numero, { id: "", pdf_url: null }); // evitar dobles en el mismo lote
      }
    }

    const totalImporte = facturas.reduce((s: number, f: any) => s + Number(f.importe ?? f.importe_total ?? 0), 0);

    return NextResponse.json({
      ok:        true,
      insertadas,
      actualizadas,
      duplicadas,
      errores,
      total_recibidas: facturas.length,
      total_importe:   Math.round(totalImporte * 100) / 100,
      mensaje: `${insertadas} nuevas, ${actualizadas} PDFs actualizados, ${duplicadas} ya existían`,
    }, { headers: CORS_HEADERS });

  } catch (err: any) {
    console.error("[obramat/sync] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
