/**
 * Script de seed — crea el tenant, el admin y los empleados en InsForge.
 * Ejecutar: node scripts/seed-users.mjs
 */

import { createClient } from "@insforge/sdk";

const insforge = createClient({
  baseUrl: "https://6jkke735.eu-central.insforge.app",
  anonKey: "ik_8ba4033c110df1574f13bffb9846d2e2",
});

// ─── Usuarios a crear ────────────────────────────────────────────────────────
const TENANT_NOMBRE = "Reformas Principal";
const PASSWORD = "123456"; // InsForge exige mínimo 6 caracteres

const USUARIOS = [
  { nombre: "Admin",            email: "admin@reformas.app",           rol: "admin"    },
  { nombre: "Roger",            email: "roger@reformas.app",           rol: "empleado" },
  { nombre: "Brandon Seaman",   email: "brandonseaman@reformas.app",   rol: "empleado" },
  { nombre: "Brandon Gonzales", email: "brandongonzales@reformas.app", rol: "empleado" },
  { nombre: "Carlos",           email: "carlos@reformas.app",          rol: "empleado" },
  { nombre: "Santiago",         email: "santiago@reformas.app",        rol: "empleado" },
];

// ─── Helper: esperar un poco entre llamadas ──────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("🚀 Iniciando seed de usuarios...\n");

  // 1. Crear el tenant ─────────────────────────────────────────────────────
  console.log("📦 Creando tenant...");
  const { data: tenantData, error: tenantError } = await insforge.database
    .from("tenants")
    .insert({ nombre: TENANT_NOMBRE, plan: "basic" })
    .select()
    .single();

  if (tenantError) {
    // Si ya existe, intentamos recuperarlo
    console.warn("⚠️  Error al crear tenant:", tenantError.message);
    const { data: existing } = await insforge.database
      .from("tenants")
      .select("*")
      .limit(1)
      .single();
    if (!existing) {
      console.error("❌ No se pudo crear ni recuperar el tenant. Abortando.");
      process.exit(1);
    }
    console.log(`✅ Tenant existente recuperado: ${existing.nombre} (${existing.id})\n`);
    await crearUsuarios(existing.id);
  } else {
    console.log(`✅ Tenant creado: ${tenantData.nombre} (${tenantData.id})\n`);
    await crearUsuarios(tenantData.id);
  }
}

async function crearUsuarios(tenantId) {
  console.log(`🏢 Tenant ID: ${tenantId}\n`);
  console.log("👥 Creando usuarios...\n");

  for (const usuario of USUARIOS) {
    process.stdout.write(`  → ${usuario.nombre} (${usuario.email}) [${usuario.rol}]... `);

    // 1. Crear cuenta de auth en InsForge
    const { data: authData, error: authError } = await insforge.auth.signUp({
      email: usuario.email,
      password: PASSWORD,
      name: usuario.nombre,
    });

    if (authError) {
      console.log(`⚠️  Auth error: ${authError.message}`);
      // Si ya existe el usuario, intentar obtener su ID e insertar perfil
      await sleep(300);
      continue;
    }

    const userId = authData?.user?.id;
    if (!userId) {
      console.log("⚠️  No se obtuvo user ID");
      continue;
    }

    // 2. Insertar perfil en tabla users
    const { error: profileError } = await insforge.database
      .from("users")
      .upsert({
        id: userId,
        tenant_id: tenantId,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        activo: true,
      });

    if (profileError) {
      console.log(`⚠️  Perfil error: ${profileError.message}`);
    } else {
      console.log(`✅ OK (ID: ${userId.slice(0, 8)}...)`);
    }

    await sleep(400); // pequeña pausa entre llamadas
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Seed completado.");
  console.log("\n📋 Credenciales de acceso:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const u of USUARIOS) {
    console.log(`  ${u.rol === "admin" ? "🔑" : "👷"} ${u.nombre.padEnd(20)} ${u.email}  →  contraseña: ${PASSWORD}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((e) => {
  console.error("❌ Error inesperado:", e);
  process.exit(1);
});
