import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const INSFORGE_KEY = process.env.NEXT_PUBLIC_INSFORGE_KEY!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, password, rol, tenant_id, tarifa_diaria } = body;

    if (!nombre || !email || !password || !rol || !tenant_id) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // ── Cliente con service key: SOLO para crear el auth user ──────────────
    // (el service key no afecta la sesión del admin en el navegador)
    const authClient = createClient({ baseUrl: INSFORGE_URL, anonKey: SERVICE_KEY || INSFORGE_KEY });

    // ── Cliente con el JWT del admin: para operaciones de DB ──────────────
    // Así auth.uid() devuelve el ID del admin y is_admin() → true
    const authHeader  = req.headers.get("authorization") ?? "";
    const adminToken  = authHeader.replace(/^Bearer\s+/i, "").trim();
    const dbClient    = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: adminToken || INSFORGE_KEY,
    });

    // ── 1. Crear cuenta auth ───────────────────────────────────────────────
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      name: nombre,
    });

    // Si ya existe en auth, intentar insertar el perfil de todas formas
    // (puede que un intento anterior fallase a medias)
    let userId: string | null = null;

    if (authError) {
      const msg = (authError as any)?.message ?? String(authError);
      const yaExiste = msg.toLowerCase().includes("already") ||
                       msg.toLowerCase().includes("exist")   ||
                       msg.toLowerCase().includes("duplicate");

      if (!yaExiste) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      // Ya existe en auth — comprobar si ya tiene perfil en users
      const { data: perfilExistente } = await dbClient.database
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (perfilExistente) {
        return NextResponse.json(
          { error: "Este email ya está registrado y tiene perfil. El usuario ya existe en la aplicación." },
          { status: 400 }
        );
      }

      // Tiene auth pero no perfil — intentar recuperar su UUID
      // probando con la API de admin si está disponible
      try {
        const adminAuth = (authClient.auth as any).admin;
        if (adminAuth?.getUserByEmail) {
          const { data: existingAuthUser } = await adminAuth.getUserByEmail(email);
          userId = existingAuthUser?.user?.id ?? null;
        }
      } catch { /* API admin no disponible */ }

      if (!userId) {
        return NextResponse.json(
          {
            error:
              "Este email ya existe en el sistema de autenticación pero sin perfil. " +
              "Ve a InsForge → Authentication, copia el UUID del usuario '" + email + "' " +
              "y ejecuta en SQL Editor:\n" +
              "INSERT INTO users (id, tenant_id, nombre, email, rol, activo) VALUES " +
              "('<UUID_COPIADO>', '" + tenant_id + "', '" + nombre + "', '" + email + "', '" + rol + "', true);",
          },
          { status: 400 }
        );
      }
    } else {
      if (!authData?.user) {
        return NextResponse.json({ error: "No se pudo obtener el usuario creado" }, { status: 400 });
      }
      userId = authData.user.id;
    }

    // ── 2. Insertar perfil en tabla users (con JWT del admin) ──────────────
    const { data: profileData, error: profileError } = await dbClient.database
      .from("users")
      .insert({
        id:        userId,
        tenant_id,
        nombre,
        email,
        rol,
        activo:    true,
      })
      .select()
      .single();

    if (profileError) {
      const msg = (profileError as any)?.message ?? JSON.stringify(profileError);
      console.error("[create-user] Error al insertar perfil:", profileError);
      return NextResponse.json(
        { error: "El usuario auth se creó pero falló la creación del perfil: " + msg },
        { status: 400 }
      );
    }

    // ── 3. Tarifa diaria (opcional, solo empleados) ────────────────────────
    if (rol === "empleado" && tarifa_diaria) {
      const { error: tarifaError } = await dbClient.database
        .from("tarifas_empleado")
        .insert({
          user_id:      userId,
          tenant_id,
          tarifa_diaria: Number(tarifa_diaria),
          fecha_desde:   new Date().toISOString().split("T")[0],
        });

      if (tarifaError) {
        console.warn("[create-user] Tarifa no guardada:", tarifaError);
        // No fallar por esto — el usuario ya está creado
      }
    }

    return NextResponse.json({ data: profileData, error: null });

  } catch (err: any) {
    console.error("[create-user] error inesperado:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno del servidor" }, { status: 500 });
  }
}
