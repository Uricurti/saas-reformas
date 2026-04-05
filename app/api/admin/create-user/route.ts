import { NextRequest, NextResponse } from "next/server";
import { insforgeAdmin } from "@/lib/insforge/service-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, password, rol, tenant_id, tarifa_diaria } = body;

    if (!nombre || !email || !password || !rol || !tenant_id) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // 1. Crear cuenta de auth usando la service key (no afecta la sesión del admin)
    const { data: authData, error: authError } = await insforgeAdmin.auth.signUp({
      email,
      password,
      name: nombre,
    });

    if (authError || !authData?.user) {
      const msg = (authError as any)?.message ?? String(authError) ?? "Error al crear cuenta";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Insertar perfil en tabla users
    const { data: profileData, error: profileError } = await insforgeAdmin.database
      .from("users")
      .insert({
        id: userId,
        tenant_id,
        nombre,
        email,
        rol,
        activo: true,
      })
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: (profileError as any)?.message ?? "Error al crear perfil" }, { status: 400 });
    }

    // 3. Si es empleado con tarifa, guardarla
    if (rol === "empleado" && tarifa_diaria) {
      await insforgeAdmin.database.from("tarifas_empleado").insert({
        user_id: userId,
        tenant_id,
        tarifa_diaria: Number(tarifa_diaria),
        fecha_desde: new Date().toISOString().split("T")[0],
      });
    }

    return NextResponse.json({ data: profileData, error: null });
  } catch (err: any) {
    console.error("[create-user] error:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno del servidor" }, { status: 500 });
  }
}
