/**
 * API Route: crear usuario (admin only)
 *
 * InsForge usa x-api-key como header para operaciones de administración.
 * Con ese header la petición corre como "project_admin", que bypassa RLS
 * completamente — es la forma correcta de hacer operaciones de servidor.
 *
 * NO usamos createClient con el service key como anonKey (eso es Supabase).
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL  = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY   = process.env.INSFORGE_SERVICE_KEY!;

/** Cabeceras para todas las llamadas admin con x-api-key */
function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": SERVICE_KEY,
  };
}

/** Llamada directa a la REST API de InsForge con x-api-key */
async function insforgeAdmin(
  path: string,
  options: RequestInit = {}
): Promise<{ data: any; error: string | null; status: number }> {
  const url = `${INSFORGE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...adminHeaders(),
      ...(options.headers ?? {}),
    },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no JSON */ }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    return { data: null, error: msg, status: res.status };
  }
  return { data, error: null, status: res.status };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, password, rol, tenant_id, tarifa_diaria } = body;

    if (!nombre || !email || !password || !rol || !tenant_id) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    if (!SERVICE_KEY) {
      return NextResponse.json({ error: "INSFORGE_SERVICE_KEY no configurado en Vercel" }, { status: 500 });
    }

    // ── 1. Crear cuenta auth ─────────────────────────────────────────────────
    // Usamos client_type=server para que el refreshToken llegue en el body
    // (no como cookie httpOnly), evitando afectar la sesión del admin
    const { data: authData, error: authError, status: authStatus } = await insforgeAdmin(
      "/api/auth/users?client_type=server",
      {
        method: "POST",
        body: JSON.stringify({ email, password, name: nombre }),
      }
    );

    let userId: string | null = null;

    if (authError) {
      const yaExiste =
        authStatus === 409 ||
        authError.toLowerCase().includes("already") ||
        authError.toLowerCase().includes("exist") ||
        authError.toLowerCase().includes("duplicate");

      if (!yaExiste) {
        return NextResponse.json({ error: authError }, { status: 400 });
      }

      // Ya existe en auth — buscar su UUID para crear solo el perfil
      const { data: listData, error: listError } = await insforgeAdmin(
        `/api/auth/users?search=${encodeURIComponent(email)}`
      );

      const existingUser = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!existingUser?.id) {
        return NextResponse.json(
          {
            error:
              "Este email ya existe en InsForge Auth pero no se puede recuperar su UUID. " +
              "Ve a InsForge → Authentication, copia el UUID del usuario y crea el perfil manualmente.",
          },
          { status: 400 }
        );
      }

      // Comprobar si ya tiene perfil en users
      const { data: perfil } = await insforgeAdmin(
        `/api/database/records/users?email=eq.${encodeURIComponent(email)}&select=id`
      );
      if (perfil && perfil.length > 0) {
        return NextResponse.json(
          { error: "Este usuario ya existe en la aplicación." },
          { status: 400 }
        );
      }

      userId = existingUser.id;
    } else {
      userId = authData?.user?.id ?? null;
      if (!userId) {
        return NextResponse.json({ error: "No se pudo obtener el ID del usuario creado" }, { status: 400 });
      }
    }

    // ── 2. Insertar perfil en tabla users ────────────────────────────────────
    // Con x-api-key corre como project_admin → bypassa RLS
    const { data: profileData, error: profileError } = await insforgeAdmin(
      "/api/database/records/users",
      {
        method: "POST",
        body: JSON.stringify({
          id:         userId,
          tenant_id,
          nombre,
          email,
          email_auth: email,   // email fijo de InsForge, nunca cambia
          rol,
          activo:     true,
        }),
      }
    );

    if (profileError) {
      console.error("[create-user] Error al insertar perfil:", profileError);
      return NextResponse.json(
        { error: "Usuario auth creado pero falló el perfil: " + profileError },
        { status: 400 }
      );
    }

    // ── 3. Tarifa diaria (opcional, solo empleados) ──────────────────────────
    if (rol === "empleado" && tarifa_diaria) {
      const { error: tarifaError } = await insforgeAdmin(
        "/api/database/records/tarifas_empleado",
        {
          method: "POST",
          body: JSON.stringify({
            user_id:       userId,
            tenant_id,
            tarifa_diaria: Number(tarifa_diaria),
            fecha_desde:   new Date().toISOString().split("T")[0],
          }),
        }
      );
      if (tarifaError) {
        console.warn("[create-user] Tarifa no guardada:", tarifaError);
        // No fallar — usuario ya creado correctamente
      }
    }

    return NextResponse.json({ data: profileData, error: null });

  } catch (err: any) {
    console.error("[create-user] error inesperado:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
