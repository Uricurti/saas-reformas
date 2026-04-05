/**
 * NOTA: InsForge NO usa un "service role client" como Supabase.
 * El API key (INSFORGE_SERVICE_KEY, formato ins_xxxx) se usa como
 * header "x-api-key" en llamadas REST directas — no como anonKey en createClient.
 *
 * Las operaciones de administración (crear usuarios, insertar perfiles)
 * se hacen en app/api/admin/create-user/route.ts con raw fetch + x-api-key.
 *
 * Este fichero se mantiene por compatibilidad pero no se debe usar para
 * operaciones que requieren bypasear RLS.
 */

export {}; // módulo vacío — ver app/api/admin/create-user/route.ts
