/**
 * POST /api/obramat/credentials
 * Guarda las credenciales de Obramat en tenant_config.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

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

export async function POST(req: NextRequest) {
  const { tenantId, email, password } = await req.json();

  if (!tenantId || !email) {
    return NextResponse.json({ error: "tenantId y email son obligatorios" }, { status: 400 });
  }

  // Verificar si ya existe config
  const { data: existing } = await dbAdmin(
    `/api/database/records/tenant_config?tenant_id=eq.${tenantId}&limit=1`
  );

  const configId = existing?.[0]?.id;

  if (configId) {
    await dbAdmin(`/api/database/records/tenant_config?id=eq.${configId}`, "PATCH", {
      obramat_email: email,
      obramat_password: password || undefined,
    });
  } else {
    await dbAdmin("/api/database/records/tenant_config", "POST", {
      tenant_id: tenantId,
      obramat_email: email,
      obramat_password: password || undefined,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  const { data } = await dbAdmin(
    `/api/database/records/tenant_config?tenant_id=eq.${tenantId}&limit=1`
  );

  return NextResponse.json({
    obramat_email: data?.[0]?.obramat_email ?? null,
    configured: !!(data?.[0]?.obramat_email && data?.[0]?.obramat_password),
  });
}
