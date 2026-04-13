/**
 * API routes para materiales_maestros (catálogo compartido con pasillos por tienda).
 * Usa SERVICE_KEY para bypass de RLS — solo accesible desde el servidor Next.js.
 *
 * GET    ?tenantId=xxx&q=tubo              → buscar por nombre (autocomplete)
 * POST   body: { tenantId, nombre }        → crear o encontrar maestro por nombre
 * PATCH  body: { maestroId, tienda, pasillo } → guardar/limpiar pasillo (pasillo=null para limpiar)
 * DELETE ?id=xxx                           → eliminar del catálogo (solo admin)
 */
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function query(path: string): Promise<any[]> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": KEY },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : [];
}

async function mutate(path: string, method: string, body: object): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": KEY },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json().catch(() => null);
}

// ── GET: buscar materiales maestros por nombre (autocomplete) ──────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tenantId = searchParams.get("tenantId");
  const q        = searchParams.get("q")?.trim() ?? "";

  if (!tenantId) return NextResponse.json([], { status: 400 });
  if (q.length < 2) return NextResponse.json([]);

  // Búsqueda con ilike (insensible a mayúsculas/tildes)
  const encoded = encodeURIComponent(`%${q}%`);
  const data = await query(
    `/api/database/records/materiales_maestros` +
    `?tenant_id=eq.${tenantId}` +
    `&nombre=ilike.${encoded}` +
    `&order=veces_pedido.desc,nombre.asc` +
    `&limit=6`
  );

  return NextResponse.json(data);
}

// ── POST: crear o encontrar maestro por nombre ─────────────────────────────
export async function POST(req: NextRequest) {
  const { tenantId, nombre } = await req.json();
  if (!tenantId || !nombre) {
    return NextResponse.json({ error: "tenantId y nombre requeridos" }, { status: 400 });
  }

  const nombreNorm = nombre.trim().toLowerCase();

  // Buscar si ya existe (coincidencia exacta)
  const existentes = await query(
    `/api/database/records/materiales_maestros` +
    `?tenant_id=eq.${tenantId}` +
    `&nombre=ilike.${encodeURIComponent(nombreNorm)}` +
    `&limit=1`
  );

  if (existentes.length > 0) {
    const maestro = existentes[0];
    // Incrementar veces_pedido
    await mutate(
      `/api/database/records/materiales_maestros?id=eq.${maestro.id}`,
      "PATCH",
      { veces_pedido: maestro.veces_pedido + 1, updated_at: new Date().toISOString() }
    );
    return NextResponse.json({ ...maestro, veces_pedido: maestro.veces_pedido + 1 });
  }

  // Crear nuevo
  const nuevo = await mutate(
    `/api/database/records/materiales_maestros`,
    "POST",
    {
      tenant_id:            tenantId,
      nombre:               nombreNorm,
      sabadell_pasillo:     null,
      terrassa_pasillo:     null,
      otra_tienda_pasillo:  null,
      veces_pedido:         1,
    }
  );

  return NextResponse.json(Array.isArray(nuevo) ? nuevo[0] : nuevo);
}

// ── PATCH: guardar o limpiar pasillo de una tienda ────────────────────────
// pasillo puede ser un número (guardar) o null (limpiar)
export async function PATCH(req: NextRequest) {
  const { maestroId, tienda, pasillo } = await req.json();
  if (!maestroId || !tienda) {
    return NextResponse.json({ error: "maestroId y tienda requeridos" }, { status: 400 });
  }

  const campoTienda: Record<string, string> = {
    sabadell:  "sabadell_pasillo",
    terrassa:  "terrassa_pasillo",
    otra:      "otra_tienda_pasillo",
  };

  const campo = campoTienda[tienda];
  if (!campo) return NextResponse.json({ error: "Tienda no válida" }, { status: 400 });

  // pasillo puede ser null (limpiar) o un número (guardar)
  await mutate(
    `/api/database/records/materiales_maestros?id=eq.${maestroId}`,
    "PATCH",
    { [campo]: pasillo ?? null, updated_at: new Date().toISOString() }
  );

  return NextResponse.json({ ok: true });
}

// ── DELETE: eliminar material del catálogo ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const res = await fetch(`${BASE}/api/database/records/materiales_maestros?id=eq.${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-api-key": KEY },
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
