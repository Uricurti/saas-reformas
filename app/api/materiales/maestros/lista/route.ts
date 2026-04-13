/**
 * GET /api/materiales/maestros/lista?tenantId=xxx
 * Devuelve TODOS los materiales del catálogo de un tenant (para el gestor de pasillos del admin).
 * Usa SERVICE_KEY para bypass de RLS.
 */
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json([], { status: 400 });

  const res = await fetch(
    `${BASE}/api/database/records/materiales_maestros` +
    `?tenant_id=eq.${tenantId}` +
    `&order=nombre.asc` +
    `&limit=500`,
    {
      headers: { "Content-Type": "application/json", "x-api-key": KEY },
      cache: "no-store",
    }
  );

  if (!res.ok) return NextResponse.json([]);
  const data = await res.json();
  return NextResponse.json(Array.isArray(data) ? data : []);
}
