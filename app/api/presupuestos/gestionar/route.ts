/**
 * API Route: gestión de presupuestos y líneas
 *
 * Usa x-api-key (INSFORGE_SERVICE_KEY) para bypasear RLS en presupuestos y lineas_presupuesto.
 * El SDK de cliente (user token) no tiene permisos de escritura en esas tablas.
 *
 * POST  { action: "create", tenantId, ...presupuestoData, lineas? }  → crea presupuesto + líneas
 * PATCH { action: "update", id, ...campos }                          → actualiza presupuesto
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function adminHeaders(prefer?: boolean) {
  return {
    "Content-Type": "application/json",
    "x-api-key": SERVICE_KEY,
    ...(prefer ? { "Prefer": "return=representation" } : {}),
  };
}

async function insforgeAdmin(path: string, options: RequestInit = {}, preferReturn = false) {
  const url = `${INSFORGE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...adminHeaders(preferReturn), ...(options.headers ?? {}) },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no JSON */ }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    return { data: null, error: msg, status: res.status };
  }
  return { data, error: null, status: res.status };
}

// ── GET — listar presupuestos / obtener uno / siguiente número ────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const id       = searchParams.get("id");
  const action   = searchParams.get("action");

  // Obtener presupuesto por ID + líneas
  if (id) {
    const { data: pres } = await insforgeAdmin(
      `/api/database/records/presupuestos?id=eq.${id}`
    );
    const presupuesto = Array.isArray(pres) ? pres[0] : pres;
    if (!presupuesto) return NextResponse.json(null);

    const { data: lineas } = await insforgeAdmin(
      `/api/database/records/lineas_presupuesto?presupuesto_id=eq.${id}&order=orden.asc`
    );
    return NextResponse.json({ ...presupuesto, lineas: lineas ?? [] });
  }

  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  // Siguiente número de presupuesto
  if (action === "nextNumero") {
    const { data } = await insforgeAdmin(
      `/api/database/records/presupuestos?tenant_id=eq.${tenantId}&select=numero&order=created_at.desc&limit=100`
    );
    let maxNum = 0;
    for (const row of (data ?? []) as { numero: string }[]) {
      const match = row.numero?.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return NextResponse.json({ numero: `PRES-${String(maxNum + 1).padStart(3, "0")}` });
  }

  // Listar presupuestos
  const hoy = new Date().toISOString().split("T")[0];

  // Auto-rechazar vencidos (enviados con fecha_validez < hoy)
  await insforgeAdmin(
    `/api/database/records/presupuestos?tenant_id=eq.${tenantId}&estado=eq.enviado&fecha_validez=lt.${hoy}`,
    { method: "PATCH", body: JSON.stringify({ estado: "rechazado" }) }
  );

  let path = `/api/database/records/presupuestos?tenant_id=eq.${tenantId}&order=created_at.desc`;
  const estado   = searchParams.get("estado");
  const tipo     = searchParams.get("tipo");
  const desde    = searchParams.get("desde");
  const hasta    = searchParams.get("hasta");
  if (estado) path += `&estado=eq.${estado}`;
  if (tipo)   path += `&tipo=eq.${tipo}`;
  if (desde)  path += `&fecha_emision=gte.${desde}`;
  if (hasta)  path += `&fecha_emision=lte.${hasta}`;

  const { data, error } = await insforgeAdmin(path);
  if (error) return NextResponse.json({ error }, { status: 500 });

  let lista = (data ?? []) as any[];

  // Filtro de búsqueda textual (no soportado por InsForge directamente)
  const busqueda = searchParams.get("busqueda");
  if (busqueda) {
    const b = busqueda.toLowerCase();
    lista = lista.filter((p: any) =>
      (p.cliente_nombre ?? "").toLowerCase().includes(b) ||
      (p.cliente_apellidos ?? "").toLowerCase().includes(b) ||
      (p.cliente_ciudad ?? "").toLowerCase().includes(b) ||
      (p.cliente_direccion ?? "").toLowerCase().includes(b) ||
      (p.numero ?? "").toLowerCase().includes(b)
    );
  }

  return NextResponse.json(lista);
}

// ── POST — create presupuesto + lineas ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tenantId, lineas, ...presupuestoData } = body;

  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  const hoy     = new Date().toISOString().split("T")[0];
  const validez = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const importeBase  = presupuestoData.importeBase ?? 0;
  const porcentajeIva = presupuestoData.porcentajeIva ?? 21;
  const importeIva   = Math.round(importeBase * porcentajeIva / 100 * 100) / 100;
  const importeTotal = Math.round((importeBase + importeIva) * 100) / 100;

  const row = {
    tenant_id:          tenantId,
    numero:             presupuestoData.numero,
    version:            1,
    tipo:               presupuestoData.tipo,
    estado:             "borrador",
    cliente_nombre:     presupuestoData.clienteNombre,
    cliente_apellidos:  presupuestoData.clienteApellidos ?? null,
    cliente_nif:        presupuestoData.clienteNif ?? null,
    cliente_direccion:  presupuestoData.clienteDireccion ?? null,
    cliente_cp:         presupuestoData.clienteCp ?? null,
    cliente_ciudad:     presupuestoData.clienteCiudad ?? null,
    cliente_email:      presupuestoData.clienteEmail ?? null,
    cliente_telefono:   presupuestoData.clienteTelefono ?? null,
    fecha_emision:      hoy,
    fecha_validez:      validez,
    importe_base:       importeBase,
    porcentaje_iva:     porcentajeIva,
    importe_iva:        importeIva,
    importe_total:      importeTotal,
    forma_pago:         presupuestoData.formaPago ?? [],
    notas_internas:     presupuestoData.notasInternas ?? null,
  };

  const { data: pres, error: presError } = await insforgeAdmin(
    "/api/database/records/presupuestos",
    { method: "POST", body: JSON.stringify(row) },
    true
  );

  if (presError || !pres) {
    return NextResponse.json({ error: presError ?? "Error al crear presupuesto" }, { status: 500 });
  }

  const presupuesto = Array.isArray(pres) ? pres[0] : pres;
  const presId = presupuesto?.id;

  // Insertar líneas si se proporcionan
  if (lineas && Array.isArray(lineas) && lineas.length > 0 && presId) {
    const lineasRows = lineas.map((l: any, i: number) => ({
      tenant_id:      tenantId,
      presupuesto_id: presId,
      nombre_partida: l.nombre_partida,
      descripcion:    l.descripcion ?? null,
      precio:         l.precio,
      orden:          l.orden ?? i + 1,
      es_base:        l.es_base,
      seccion:        l.seccion ?? null,
    }));

    const { error: lineasError } = await insforgeAdmin(
      "/api/database/records/lineas_presupuesto",
      { method: "POST", body: JSON.stringify(lineasRows) }
    );

    if (lineasError) {
      console.error("[gestionar] Error insertando líneas:", lineasError);
      // Presupuesto ya creado, devolvemos igualmente para no perderlo
    }
  }

  return NextResponse.json(presupuesto);
}

// ── DELETE — delete presupuesto + lineas ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const presupuestoId = searchParams.get("presupuestoId");
  const id = searchParams.get("id");

  if (presupuestoId) {
    // Delete just lineas for a presupuesto (called from deletePresupuesto)
    await insforgeAdmin(
      `/api/database/records/lineas_presupuesto?presupuesto_id=eq.${presupuestoId}`,
      { method: "DELETE" }
    );
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Delete lineas first, then presupuesto
  await insforgeAdmin(
    `/api/database/records/lineas_presupuesto?presupuesto_id=eq.${id}`,
    { method: "DELETE" }
  );
  const { error } = await insforgeAdmin(
    `/api/database/records/presupuestos?id=eq.${id}`,
    { method: "DELETE" }
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── PATCH — update presupuesto ────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, lineas, ...params } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const hoyEdicion   = new Date().toISOString().split("T")[0];
  const validezEdicion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Al editar un presupuesto, la fecha de emisión se actualiza a hoy
  // y la validez se recalcula como hoy + 30 días.
  // Excepción: si solo se cambia el estado (ej. enviado → aceptado),
  // no se renueva la fecha. Se detecta porque solo llega el campo `estado`.
  const esSoloCambioEstado = params.estado !== undefined &&
    Object.keys(params).filter(k => k !== "estado" && k !== "tenantId").length === 0;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (!esSoloCambioEstado) {
    updates.fecha_emision = hoyEdicion;
    updates.fecha_validez = validezEdicion;
  }

  if (params.numero          !== undefined) updates.numero             = params.numero;
  if (params.version         !== undefined) updates.version            = params.version;
  if (params.tipo            !== undefined) updates.tipo               = params.tipo;
  if (params.estado          !== undefined) updates.estado             = params.estado;
  if (params.clienteNombre   !== undefined) updates.cliente_nombre     = params.clienteNombre;
  if (params.clienteApellidos !== undefined) updates.cliente_apellidos = params.clienteApellidos;
  if (params.clienteNif      !== undefined) updates.cliente_nif        = params.clienteNif;
  if (params.clienteDireccion !== undefined) updates.cliente_direccion = params.clienteDireccion;
  if (params.clienteCp       !== undefined) updates.cliente_cp         = params.clienteCp;
  if (params.clienteCiudad   !== undefined) updates.cliente_ciudad     = params.clienteCiudad;
  if (params.clienteEmail    !== undefined) updates.cliente_email      = params.clienteEmail;
  if (params.clienteTelefono !== undefined) updates.cliente_telefono   = params.clienteTelefono;
  if (params.notasInternas   !== undefined) updates.notas_internas     = params.notasInternas;
  if (params.obraId          !== undefined) updates.obra_id            = params.obraId;
  if (params.formaPago       !== undefined) updates.forma_pago         = params.formaPago;

  if (params.importeBase !== undefined || params.porcentajeIva !== undefined) {
    // Need current values if only one is changing — fetch via admin
    let base = params.importeBase;
    let iva  = params.porcentajeIva;
    if (base === undefined || iva === undefined) {
      const { data: current } = await insforgeAdmin(
        `/api/database/records/presupuestos?id=eq.${id}&select=importe_base,porcentaje_iva`
      );
      const cur = Array.isArray(current) ? current[0] : current;
      base = base ?? cur?.importe_base ?? 0;
      iva  = iva  ?? cur?.porcentaje_iva ?? 21;
    }
    updates.importe_base   = base;
    updates.porcentaje_iva = iva;
    updates.importe_iva    = Math.round(base * iva / 100 * 100) / 100;
    updates.importe_total  = Math.round((base + updates.importe_iva) * 100) / 100;
  }

  const { data, error } = await insforgeAdmin(
    `/api/database/records/presupuestos?id=eq.${id}`,
    { method: "PATCH", body: JSON.stringify(updates) },
    true
  );

  if (error) return NextResponse.json({ error }, { status: 500 });

  const presupuesto = Array.isArray(data) ? data[0] : data;

  // Si se proporcionan líneas, reemplazarlas
  if (lineas !== undefined && params.tenantId) {
    // Delete existing lineas
    await insforgeAdmin(
      `/api/database/records/lineas_presupuesto?presupuesto_id=eq.${id}`,
      { method: "DELETE" }
    );

    if (Array.isArray(lineas) && lineas.length > 0) {
      const lineasRows = lineas.map((l: any, i: number) => ({
        tenant_id:      params.tenantId,
        presupuesto_id: id,
        nombre_partida: l.nombre_partida,
        descripcion:    l.descripcion ?? null,
        precio:         l.precio,
        orden:          l.orden ?? i + 1,
        es_base:        l.es_base,
        seccion:        l.seccion ?? null,
      }));

      await insforgeAdmin(
        "/api/database/records/lineas_presupuesto",
        { method: "POST", body: JSON.stringify(lineasRows) }
      );
    }
  }

  return NextResponse.json(presupuesto ?? { ok: true });
}
