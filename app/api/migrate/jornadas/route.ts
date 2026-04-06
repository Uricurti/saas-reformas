import { NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function headers() {
  return { "Content-Type": "application/json", "x-api-key": SERVICE_KEY };
}

async function dbGet(path: string) {
  const res = await fetch(`${INSFORGE_URL}/api/database/records${path}`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function dbPost(path: string, body: object) {
  const res = await fetch(`${INSFORGE_URL}/api/database/records${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function POST() {
  try {
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: "INSFORGE_SERVICE_KEY not configured" }, { status: 500 });
    }

    // 1. Read all fichajes
    const fichajes = await dbGet("/fichajes?limit=5000&order=created_at.asc");

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const f of fichajes) {
      // Check if jornada already exists for this user+date
      const existing = await dbGet(
        `/jornadas?user_id=eq.${f.user_id}&fecha=eq.${f.fecha}&limit=1`
      );
      if (existing.length > 0) { skipped++; continue; }

      const ok = await dbPost("/jornadas", {
        tenant_id:  f.tenant_id,
        user_id:    f.user_id,
        obra_id:    f.obra_id ?? null,
        fecha:      f.fecha,
        estado:     f.estado ?? "trabajando",
        es_libre:   f.estado !== "trabajando",
        ha_fichado: true,
        fichado_at: f.hora_registro ?? f.created_at,
        created_at: f.created_at,
      });

      if (ok) migrated++;
      else errors++;
    }

    return NextResponse.json({
      ok: true,
      total: fichajes.length,
      migrated,
      skipped,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
