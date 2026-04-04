/**
 * Seed definitivo — usa la anon key directamente sobre el endpoint HTTP
 * para saltarse el bootstrapping RLS (la tabla users está vacía, nadie es admin aún).
 *
 * Ejecutar: node scripts/seed-direct.mjs
 */

const BASE_URL = "https://6jkke735.eu-central.insforge.app";
const ANON_KEY = "ik_8ba4033c110df1574f13bffb9846d2e2";
const PASSWORD  = "123456";

const USUARIOS = [
  { nombre: "Admin",            email: "admin@reformas.app",           rol: "admin"    },
  { nombre: "Roger",            email: "roger@reformas.app",           rol: "empleado" },
  { nombre: "Brandon Seaman",   email: "brandonseaman@reformas.app",   rol: "empleado" },
  { nombre: "Brandon Gonzales", email: "brandongonzales@reformas.app", rol: "empleado" },
  { nombre: "Carlos",           email: "carlos@reformas.app",          rol: "empleado" },
  { nombre: "Santiago",         email: "santiago@reformas.app",        rol: "empleado" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── helpers ───────────────────────────────────────────────────────────────────

async function dbGet(path, params = {}) {
  const url = new URL(`${BASE_URL}/api/database/records/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
  });
  return res.json();
}

async function dbPost(path, body) {
  const res = await fetch(`${BASE_URL}/api/database/records/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, data: text }; }
}

async function dbDelete(path, params = {}) {
  const url = new URL(`${BASE_URL}/api/database/records/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
}

async function authLogin(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Seed directo (bypass RLS con anon key)\n");

  // 1. Tenant ──────────────────────────────────────────────────────────────────
  const tenants = await dbGet("tenants", { order: "created_at.asc" });
  let tenantId;

  if (!tenants || tenants.length === 0) {
    const { data } = await dbPost("tenants", { nombre: "Reformas Principal", plan: "basic" });
    tenantId = Array.isArray(data) ? data[0]?.id : data?.id;
    console.log(`✅ Tenant creado: ${tenantId}`);
  } else {
    tenantId = tenants[0].id;
    console.log(`✅ Tenant existente: ${tenants[0].nombre} (${tenantId})`);
    if (tenants.length > 1) {
      console.log(`   ℹ️  Hay ${tenants.length} tenants, se usará el primero.`);
    }
  }

  // 2. Limpiar perfiles previos para re-seeding limpio ─────────────────────────
  const existentes = await dbGet("users", { tenant_id: `eq.${tenantId}` });
  if (existentes.length > 0) {
    console.log(`\n🧹 Limpiando ${existentes.length} perfil(es) existente(s)...`);
    await dbDelete("users", { tenant_id: `eq.${tenantId}` });
    // Limpiar también sus tarifas
    await dbDelete("tarifas_empleado", { tenant_id: `eq.${tenantId}` });
  }

  // 3. Usuarios ────────────────────────────────────────────────────────────────
  console.log("\n👥 Procesando usuarios...\n");
  const resultados = [];

  for (const u of USUARIOS) {
    process.stdout.write(`  → ${u.nombre.padEnd(20)} `);

    // Login para obtener el ID real del usuario en InsForge Auth
    const session = await authLogin(u.email, PASSWORD);

    if (!session?.user?.id) {
      console.log(`❌ Login fallido: ${JSON.stringify(session?.error ?? session)}`);
      await sleep(300);
      continue;
    }

    const userId = session.user.id;

    // Insertar perfil usando anon key (bypassa RLS)
    const { ok, data } = await dbPost("users", {
      id: userId,
      tenant_id: tenantId,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: true,
    });

    if (!ok || (typeof data === "string" && data.includes("error"))) {
      console.log(`⚠️  Perfil: ${typeof data === "string" ? data.slice(0, 80) : JSON.stringify(data)}`);
    } else {
      console.log(`✅ ID: ${userId.slice(0, 8)}...`);
      resultados.push({ ...u, id: userId });
    }

    // Tarifa por defecto para empleados
    if (u.rol === "empleado") {
      await dbPost("tarifas_empleado", {
        user_id: userId,
        tenant_id: tenantId,
        tarifa_diaria: 0,
        fecha_desde: new Date().toISOString().split("T")[0],
      });
    }

    await sleep(200);
  }

  // ── Resumen ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 ¡Seed completado!");
  console.log("\n📋 Credenciales (URL: http://localhost:3000/login):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const u of USUARIOS) {
    const icon  = u.rol === "admin" ? "🔑" : "👷";
    console.log(`  ${icon} ${u.nombre.padEnd(20)} ${u.email.padEnd(38)} / ${PASSWORD}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\n  Tenant ID : ${tenantId}`);
  console.log(`  Creados   : ${resultados.length} / ${USUARIOS.length}`);
  console.log();
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); });
