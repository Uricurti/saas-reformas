/**
 * GET /api/gastos/list?tenantId=xxx&mes=5&anio=2026
 *
 * Lista los gastos de un tenant. Usa service key para bypassear RLS.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const mes      = searchParams.get("mes");
  const anio     = searchParams.get("anio");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });
  }

  let path = `/api/database/records/gastos?tenant_id=eq.${tenantId}&order=fecha_factura.desc&limit=500`;
  if (mes)  path += `&mes=eq.${mes}`;
  if (anio) path += `&anio=eq.${anio}`;

  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(Array.isArray(data) ? data : []);
}
