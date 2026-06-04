/**
 * API Route: factura directa (sin obra)
 * Usa service key para bypassear RLS — el cliente no tiene permisos de escritura en facturas.
 *
 * POST { tenantId, concepto, numeroFactura, fecha, porcentajeIva, lineas, formaPago,
 *        clienteNombre, clienteNif?, clienteEmail?, clienteTelefono?,
 *        facturacionNombre?, facturacionNif?, facturacionDireccion?, facturacionCp?, facturacionCiudad? }
 * GET  ?tenantId=xxx  → lista facturas directas (obra_id IS NULL)
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function adminHeaders(prefer = false) {
  return {
    "Content-Type": "application/json",
    "x-api-key": SERVICE_KEY,
    ...(prefer ? { Prefer: "return=representation" } : {}),
  };
}

async function insforgeAdmin(path: string, options: RequestInit = {}, prefer = false) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    ...options,
    headers: { ...adminHeaders(prefer), ...(options.headers ?? {}) },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /**/ }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    return { data: null, error: msg };
  }
  return { data, error: null };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    tenantId, concepto, numeroFactura, fecha, porcentajeIva,
    lineas, formaPago,
    clienteNombre, clienteNif, clienteEmail, clienteTelefono,
    facturacionNombre, facturacionNif, facturacionDireccion, facturacionCp, facturacionCiudad,
  } = body;

  if (!tenantId || !concepto || !numeroFactura) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Calcular importe base a partir de las líneas
  const importeBase = (lineas ?? []).reduce((s: number, l: any) => s + (l.precio ?? 0), 0);

  // Crear la factura
  const { data: factura, error: facError } = await insforgeAdmin(
    "/api/database/records/facturas",
    {
      method: "POST",
      body: JSON.stringify({
        tenant_id:            tenantId,
        obra_id:              null,
        concepto,
        importe_total:        importeBase,
        numero_factura:       numeroFactura,
        porcentaje_iva:       porcentajeIva ?? 21,
        fecha_emision:        fecha ?? new Date().toISOString().split("T")[0],
        lineas_partidas:      lineas ?? [],
        cliente_nombre:       clienteNombre ?? null,
        cliente_nif:          clienteNif ?? null,
        cliente_email:        clienteEmail ?? null,
        cliente_telefono:     clienteTelefono ?? null,
        facturacion_nombre:   facturacionNombre ?? null,
        facturacion_nif:      facturacionNif ?? null,
        facturacion_direccion: facturacionDireccion ?? null,
        facturacion_cp:       facturacionCp ?? null,
        facturacion_ciudad:   facturacionCiudad ?? null,
      }),
    },
    true
  );

  if (facError || !factura) {
    return NextResponse.json({ error: facError ?? "Error al crear factura" }, { status: 500 });
  }

  const facturaObj = Array.isArray(factura) ? factura[0] : factura;
  const facturaId  = facturaObj?.id;

  // Crear pagos. El primer pago se marca como "emitida" con el número de factura
  // para que getNextNumeroFactura lo cuente y el contador avance correctamente.
  if (formaPago && Array.isArray(formaPago) && formaPago.length > 0 && facturaId) {
    const ivaPercent = porcentajeIva ?? 21;
    const pagoRows = formaPago.map((fp: any, i: number) => {
      const importe_base = Math.round(importeBase * fp.porcentaje / 100 * 100) / 100;
      return {
        tenant_id:   tenantId,
        factura_id:  facturaId,
        obra_id:     null,
        orden:       i + 1,
        concepto:    fp.concepto,
        porcentaje:  fp.porcentaje,
        importe_base,
        importe_extra: 0,
        importe_total: importe_base,
        importe_facturado_a: importe_base,
        importe_efectivo_b: 0,
        porcentaje_iva_a: ivaPercent,
        fecha_prevista: fp.fechaPrevista ?? null,
        // El primer pago se marca como emitida con el número de factura,
        // así getNextNumeroFactura lo cuenta y el contador avanza
        estado: i === 0 ? "emitida" : "pendiente_emitir",
        numero_factura_emitida: i === 0 ? numeroFactura : null,
        fecha_cobro: null,
      };
    });

    await insforgeAdmin(
      "/api/database/records/pagos",
      { method: "POST", body: JSON.stringify(pagoRows) }
    );
  }

  return NextResponse.json(facturaObj);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const {
    id, concepto, numeroFactura, fecha, porcentajeIva,
    lineas, formaPago,
    clienteNombre, clienteNif, clienteEmail, clienteTelefono,
    facturacionNombre, facturacionNif, facturacionDireccion, facturacionCp, facturacionCiudad,
    tenantId,
  } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const importeBase = (lineas ?? []).reduce((s: number, l: any) => s + (l.precio ?? 0), 0);

  const { error } = await insforgeAdmin(
    `/api/database/records/facturas?id=eq.${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        concepto,
        importe_total:        importeBase,
        numero_factura:       numeroFactura,
        porcentaje_iva:       porcentajeIva ?? 21,
        fecha_emision:        fecha,
        lineas_partidas:      lineas ?? [],
        cliente_nombre:       clienteNombre ?? null,
        cliente_nif:          clienteNif ?? null,
        cliente_email:        clienteEmail ?? null,
        cliente_telefono:     clienteTelefono ?? null,
        facturacion_nombre:   facturacionNombre ?? null,
        facturacion_nif:      facturacionNif ?? null,
        facturacion_direccion: facturacionDireccion ?? null,
        facturacion_cp:       facturacionCp ?? null,
        facturacion_ciudad:   facturacionCiudad ?? null,
        updated_at:           new Date().toISOString(),
      }),
    }
  );

  if (error) return NextResponse.json({ error }, { status: 500 });

  // Reemplazar pagos: borrar los existentes e insertar nuevos
  await insforgeAdmin(`/api/database/records/pagos?factura_id=eq.${id}`, { method: "DELETE" });

  if (formaPago && Array.isArray(formaPago) && formaPago.length > 0 && tenantId) {
    const ivaPercent = porcentajeIva ?? 21;
    const pagoRows = formaPago.map((fp: any, i: number) => {
      const importe_base = Math.round(importeBase * fp.porcentaje / 100 * 100) / 100;
      return {
        tenant_id:  tenantId,
        factura_id: id,
        obra_id:    null,
        orden:      i + 1,
        concepto:   fp.concepto,
        porcentaje: fp.porcentaje,
        importe_base,
        importe_extra: 0,
        importe_total: importe_base,
        importe_facturado_a: importe_base,
        importe_efectivo_b:  0,
        porcentaje_iva_a:    ivaPercent,
        fecha_prevista:      fp.fechaPrevista ?? null,
        estado:              i === 0 ? "emitida" : "pendiente_emitir",
        numero_factura_emitida: i === 0 ? numeroFactura : null,
        fecha_cobro: null,
      };
    });
    await insforgeAdmin("/api/database/records/pagos", { method: "POST", body: JSON.stringify(pagoRows) });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await insforgeAdmin(`/api/database/records/pagos?factura_id=eq.${id}`, { method: "DELETE" });
  const { error } = await insforgeAdmin(`/api/database/records/facturas?id=eq.${id}`, { method: "DELETE" });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  const { data: facturas, error } = await insforgeAdmin(
    `/api/database/records/facturas?tenant_id=eq.${tenantId}&obra_id=is.null&order=created_at.desc`
  );
  if (error) return NextResponse.json({ error }, { status: 500 });

  const lista = facturas ?? [];
  if (lista.length === 0) return NextResponse.json([]);

  // Cargar pagos de cada factura para reconstruir formaPago
  const ids = lista.map((f: any) => f.id).join(",");
  const { data: pagos } = await insforgeAdmin(
    `/api/database/records/pagos?factura_id=in.(${ids})&order=orden.asc`
  );

  const pagosPorFactura: Record<string, any[]> = {};
  for (const p of (pagos ?? [])) {
    if (!pagosPorFactura[p.factura_id]) pagosPorFactura[p.factura_id] = [];
    pagosPorFactura[p.factura_id].push(p);
  }

  const resultado = lista.map((f: any) => ({
    ...f,
    pagos: pagosPorFactura[f.id] ?? [],
  }));

  return NextResponse.json(resultado);
}
