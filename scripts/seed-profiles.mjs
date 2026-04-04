/**
 * Obtiene el ID de cada usuario haciendo login y crea/actualiza su perfil en users.
 * Ejecutar: node scripts/seed-profiles.mjs
 */

import { createClient } from "@insforge/sdk";

const insforge = createClient({
  baseUrl: "https://6jkke735.eu-central.insforge.app",
  anonKey: "ik_8ba4033c110df1574f13bffb9846d2e2",
});

const PASSWORD = "123456";

const USUARIOS = [
  { nombre: "Admin",            email: "admin@reformas.app",           rol: "admin"    },
  { nombre: "Roger",            email: "roger@reformas.app",           rol: "empleado" },
  { nombre: "Brandon Seaman",   email: "brandonseaman@reformas.app",   rol: "empleado" },
  { nombre: "Brandon Gonzales", email: "brandongonzales@reformas.app", rol: "empleado" },
  { nombre: "Carlos",           email: "carlos@reformas.app",          rol: "empleado" },
  { nombre: "Santiago",         email: "santiago@reformas.app",        rol: "empleado" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("🔍 Buscando o creando tenant...\n");

  // Limpiar tenants duplicados y quedarnos con uno solo
  const { data: tenants } = await insforge.database
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: true });

  let tenantId;
  if (!tenants || tenants.length === 0) {
    const { data: newTenant } = await insforge.database
      .from("tenants")
      .insert({ nombre: "Reformas Principal", plan: "basic" })
      .select()
      .single();
    tenantId = newTenant.id;
    console.log(`✅ Tenant creado: ${tenantId}`);
  } else {
    tenantId = tenants[0].id;
    console.log(`✅ Usando tenant: ${tenants[0].nombre} (${tenantId})`);
    // Eliminar tenants extras si hay más de uno
    if (tenants.length > 1) {
      console.log(`   ℹ️  Hay ${tenants.length} tenants. Se usa el primero.`);
    }
  }

  console.log("\n👥 Procesando usuarios...\n");

  const resultados = [];

  for (const usuario of USUARIOS) {
    process.stdout.write(`  → ${usuario.nombre} (${usuario.email})... `);

    // 1. Login para obtener el ID real del usuario en InsForge
    const { data: session, error: loginError } = await insforge.auth.signInWithPassword({
      email: usuario.email,
      password: PASSWORD,
    });

    if (loginError || !session?.user?.id) {
      console.log(`❌ Login fallido: ${loginError?.nextActions ?? loginError?.message ?? "sin sesión"}`);
      continue;
    }

    const userId = session.user.id;

    // 2. Upsert del perfil en nuestra tabla users
    const { error: profileError } = await insforge.database
      .from("users")
      .upsert({
        id: userId,
        tenant_id: tenantId,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        activo: true,
      }, { onConflict: "id" });

    if (profileError) {
      console.log(`⚠️  Perfil: ${profileError.message}`);
    } else {
      console.log(`✅ ID: ${userId.slice(0, 8)}...`);
      resultados.push({ ...usuario, id: userId });
    }

    // 3. Si es empleado, añadir tarifa por defecto (0 — admin la cambia después)
    if (usuario.rol === "empleado") {
      const { data: tarifaExistente } = await insforge.database
        .from("tarifas_empleado")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!tarifaExistente) {
        await insforge.database.from("tarifas_empleado").insert({
          user_id: userId,
          tenant_id: tenantId,
          tarifa_diaria: 0,
          fecha_desde: new Date().toISOString().split("T")[0],
        });
      }
    }

    await sleep(300);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 ¡Seed completado con éxito!");
  console.log("\n📋 Credenciales de acceso (URL: http://localhost:3000/login):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const u of USUARIOS) {
    const icon = u.rol === "admin" ? "🔑" : "👷";
    const nombre = u.nombre.padEnd(20);
    console.log(`  ${icon} ${nombre} ${u.email.padEnd(35)} / ${PASSWORD}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\n  Tenant ID: ${tenantId}`);
  console.log(`  Usuarios creados: ${resultados.length}/${USUARIOS.length}\n`);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
