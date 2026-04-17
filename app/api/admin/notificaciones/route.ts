/**
 * GET /api/admin/notificaciones?tenantId=xxx
 * Devuelve stats + por usuario + log reciente de todas las notificaciones del tenant.
 * Usa x-api-key para bypass RLS.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function adminFetch(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": SERVICE_KEY,
    },
  });
  if (!res.ok) return [];
  try { return await res.json(); } catch { return []; }
}

export async function GET(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  // Obtener notificaciones del tenant (últimas 500)
  const notifs: any[] = await adminFetch(
    `/api/database/records/notificaciones?tenant_id=eq.${tenantId}&order=created_at.desc&limit=500`
  );

  // Obtener usuarios del tenant para cruzar nombres
  const users: any[] = await adminFetch(
    `/api/database/records/users?tenant_id=eq.${tenantId}&select=id,nombre,email`
  );
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  // ── Stats globales ────────────────────────────────────────────────────────
  const total     = notifs.length;
  const leidas    = notifs.filter((n) => n.leida).length;
  const noLeidas  = total - leidas;
  const pctLeidas = total > 0 ? Math.round((leidas / total) * 100) : 0;
  const usuariosConNotif = new Set(notifs.map((n) => n.user_id)).size;

  // ── Por usuario ───────────────────────────────────────────────────────────
  const porUsuarioMap: Record<string, {
    userId: string; nombre: string; email: string;
    total: number; leidas: number; noLeidas: number; ultima: string;
  }> = {};

  for (const n of notifs) {
    const uid = n.user_id;
    if (!porUsuarioMap[uid]) {
      const u = userMap[uid];
      porUsuarioMap[uid] = {
        userId:   uid,
        nombre:   u?.nombre ?? "Usuario desconocido",
        email:    u?.email  ?? "",
        total:    0,
        leidas:   0,
        noLeidas: 0,
        ultima:   n.created_at,
      };
    }
    porUsuarioMap[uid].total++;
    if (n.leida) porUsuarioMap[uid].leidas++;
    else         porUsuarioMap[uid].noLeidas++;
    // La primera que encontramos ya es la más reciente (orden desc)
    if (n.created_at > porUsuarioMap[uid].ultima) {
      porUsuarioMap[uid].ultima = n.created_at;
    }
  }

  const porUsuario = Object.values(porUsuarioMap).sort((a, b) => b.total - a.total);

  // ── Log reciente (últimas 50) ─────────────────────────────────────────────
  const recientes = notifs.slice(0, 50).map((n) => ({
    id:         n.id,
    userId:     n.user_id,
    nombre:     userMap[n.user_id]?.nombre ?? "—",
    titulo:     n.titulo,
    mensaje:    n.mensaje,
    tipo:       n.tipo,
    leida:      n.leida,
    created_at: n.created_at,
  }));

  return NextResponse.json({
    stats: { total, leidas, noLeidas, pctLeidas, usuariosConNotif },
    porUsuario,
    recientes,
  });
}
