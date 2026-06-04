/**
 * GET /api/facturacion/todas?tenantId=xxx
 * Devuelve todos los pagos emitidos + facturas directas para el resumen global.
 * Usa service key para bypassear RLS.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function admin(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /**/ }
  if (!res.ok) return { data: null, error: data?.message ?? `HTTP ${res.status}` };
  return { data, error: null };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  // 1. Pagos emitidos de obras (estado emitida o cobrada, con numero_factura_emitida)
  const { data: pagos } = await admin(
    `/api/database/records/pagos?tenant_id=eq.${tenantId}&estado=in.(emitida,cobrada)&numero_factura_emitida=not.is.null&order=created_at.desc&limit=500`
  );

  // 2. Facturas directas (obra_id IS NULL)
  const { data: directas } = await admin(
    `/api/database/records/facturas?tenant_id=eq.${tenantId}&obra_id=is.null&order=created_at.desc&limit=500`
  );

  // 3. Para los pagos de obras, necesitamos el nombre de la obra y el concepto de la factura
  const facturaIds = Array.from(new Set((pagos ?? []).map((p: any) => p.factura_id)));
  let facturaMap: Record<string, any> = {};
  if (facturaIds.length > 0) {
    const { data: facturas } = await admin(
      `/api/database/records/facturas?id=in.(${facturaIds.join(",")})&select=id,concepto,obra_id`
    );
    const obraIds = Array.from(new Set((facturas ?? []).map((f: any) => f.obra_id).filter(Boolean)));
    let obraMap: Record<string, string> = {};
    if (obraIds.length > 0) {
      const { data: obras } = await admin(
        `/api/database/records/obras?id=in.(${obraIds.join(",")})&select=id,nombre,cliente_nombre`
      );
      for (const o of (obras ?? [])) obraMap[o.id] = o;
    }
    for (const f of (facturas ?? [])) {
      facturaMap[f.id] = { ...f, obra: obraMap[f.obra_id] ?? null };
    }
  }

  // Construir lista unificada
  const pagosObra = (pagos ?? [])
    // Excluir pagos de facturas directas (obra_id IS NULL de la factura)
    .filter((p: any) => {
      const f = facturaMap[p.factura_id];
      return f && f.obra_id; // solo pagos de obras reales
    })
    .map((p: any) => {
      const f = facturaMap[p.factura_id] ?? {};
      const obra = f.obra ?? {};
      const ivaPercent = p.porcentaje_iva_a ?? 21;
      const base = (p.importe_facturado_a ?? p.importe_base) + (p.importe_extra ?? 0);
      const iva  = Math.round(base * ivaPercent / 100 * 100) / 100;
      return {
        tipo:            "obra" as const,
        id:              p.id,
        numero:          p.numero_factura_emitida,
        fecha:           p.created_at?.split("T")[0] ?? null,
        concepto:        `${f.concepto ?? ""} — ${p.concepto}`,
        cliente:         obra.cliente_nombre ?? obra.nombre ?? "—",
        obra_nombre:     obra.nombre ?? "—",
        obra_id:         f?.obra_id ?? null,
        importe_base:    base,
        importe_iva:     iva,
        importe_total:   Math.round((base + iva) * 100) / 100,
        estado:          p.estado,
        factura_id:      p.factura_id,
        pago_id:         p.id,
      };
    });

  // Para directas, cargar pagos para el preview
  const directasConPagos = await Promise.all((directas ?? []).map(async (f: any) => {
    const { data: fpagos } = await admin(
      `/api/database/records/pagos?factura_id=eq.${f.id}&order=orden.asc`
    );
    return { ...f, pagos: fpagos ?? [] };
  }));

  const pagosDirectas = directasConPagos.map((f: any) => {
    const base = f.importe_total ?? 0;
    const iva  = Math.round(base * (f.porcentaje_iva ?? 21) / 100 * 100) / 100;
    return {
      tipo:           "directa" as const,
      id:             f.id,
      numero:         f.numero_factura ?? "—",
      fecha:          f.fecha_emision?.split("T")[0] ?? f.created_at?.split("T")[0] ?? null,
      concepto:       f.concepto,
      cliente:        f.facturacion_nombre ?? f.cliente_nombre ?? "—",
      obra_nombre:    null,
      obra_id:        null,
      importe_base:   base,
      importe_iva:    iva,
      importe_total:  Math.round((base + iva) * 100) / 100,
      estado:         "emitida",
      factura_id:     f.id,
      pago_id:        null,
      directa_data: {
        id: f.id, numero_factura: f.numero_factura, fecha_emision: f.fecha_emision,
        concepto: f.concepto, porcentaje_iva: f.porcentaje_iva ?? 21,
        lineas_partidas: f.lineas_partidas ?? [],
        cliente_nombre: f.cliente_nombre, cliente_nif: f.cliente_nif,
        cliente_email: f.cliente_email, cliente_telefono: f.cliente_telefono,
        facturacion_nombre: f.facturacion_nombre, facturacion_nif: f.facturacion_nif,
        facturacion_direccion: f.facturacion_direccion, facturacion_cp: f.facturacion_cp,
        facturacion_ciudad: f.facturacion_ciudad, pagos: f.pagos, created_at: f.created_at,
      },
    };
  });

  // Combinar y ordenar por número de factura DESC
  const todas = [...pagosObra, ...pagosDirectas].sort((a, b) => {
    const na = parseInt(a.numero?.match(/(\d+)$/)?.[1] ?? "0", 10);
    const nb = parseInt(b.numero?.match(/(\d+)$/)?.[1] ?? "0", 10);
    return nb - na;
  });

  return NextResponse.json(todas);
}
