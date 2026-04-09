/**
 * GET /api/obras/activas?tenantId=xxx
 * Devuelve todas las obras activas y pausadas del tenant usando SERVICE_KEY,
 * saltando el RLS para que los empleados puedan ver todas las obras.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });
  }

  const url =
    `${INSFORGE_URL}/api/database/records/obras` +
    `?tenant_id=eq.${tenantId}` +
    `&estado=in.(activa,pausada)` +
    `&order=created_at.desc` +
    `&select=*,asignaciones(*,user:users(*))`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": SERVICE_KEY,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Error al cargar obras" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(Array.isArray(data) ? data : []);
}
