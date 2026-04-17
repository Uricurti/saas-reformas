/**
 * API Route: gestión del catálogo de presupuestos
 *
 * Usa x-api-key (INSFORGE_SERVICE_KEY) para bypasear RLS en catalogo_presupuesto.
 * El SDK de cliente no tiene permisos de escritura en esa tabla.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": SERVICE_KEY,
  };
}

async function insforgeAdmin(path: string, options: RequestInit = {}) {
  const url = `${INSFORGE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...adminHeaders(), ...(options.headers ?? {}) },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no JSON */ }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    return { data: null, error: msg, status: res.status };
  }
  return { data, error: null, status: res.status };
}

// ── GET /api/presupuestos/catalogo?tenantId=xxx&tipo=bano ──────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const tipo     = searchParams.get("tipo");

  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  let path = `/api/database/records/catalogo_presupuesto?tenant_id=eq.${tenantId}&activo=eq.true&order=orden.asc`;
  if (tipo) path += `&tipo=eq.${tipo}`;

  const { data, error } = await insforgeAdmin(path);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ── POST /api/presupuestos/catalogo ── INSERT nueva partida ───────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tenantId, ...partida } = body;

  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  const row = {
    tenant_id:      tenantId,
    tipo:           partida.tipo,
    nombre_partida: partida.nombre_partida,
    descripcion:    partida.descripcion ?? null,
    precio:         partida.precio,
    es_base:        partida.es_base,
    orden:          partida.orden,
    activo:         partida.activo ?? true,
  };

  const { data, error } = await insforgeAdmin("/api/database/records/catalogo_presupuesto", {
    method: "POST",
    body: JSON.stringify(row),
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

// ── PATCH /api/presupuestos/catalogo ── UPDATE partida existente ──────────
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const row: any = { updated_at: new Date().toISOString() };
  if (updates.tipo           !== undefined) row.tipo           = updates.tipo;
  if (updates.nombre_partida !== undefined) row.nombre_partida = updates.nombre_partida;
  if (updates.descripcion    !== undefined) row.descripcion    = updates.descripcion;
  if (updates.precio         !== undefined) row.precio         = updates.precio;
  if (updates.es_base        !== undefined) row.es_base        = updates.es_base;
  if (updates.orden          !== undefined) row.orden          = updates.orden;
  if (updates.activo         !== undefined) row.activo         = updates.activo;

  const { data, error } = await insforgeAdmin(
    `/api/database/records/catalogo_presupuesto?id=eq.${id}`,
    { method: "PATCH", body: JSON.stringify(row) }
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

// ── DELETE /api/presupuestos/catalogo?id=xxx ──────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await insforgeAdmin(
    `/api/database/records/catalogo_presupuesto?id=eq.${id}`,
    { method: "DELETE" }
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
