-- ──────────────────────────────────────────────────────────────────
-- MIGRACIÓN 006 — Permitir al service key (project_admin) crear usuarios
--
-- CONTEXTO: En InsForge el API key (x-api-key) corre como rol "project_admin".
-- Nota: si el x-api-key bypassa RLS completamente (como indica la doc),
-- esta migración puede no ser necesaria. Se incluye como respaldo por si
-- InsForge aplica RLS incluso al project_admin en algunos contextos.
--
-- Ejecutar en InsForge → SQL Editor
-- ──────────────────────────────────────────────────────────────────

-- Política de INSERT en users: permitir admin de la empresa O project_admin (service key)
DROP POLICY IF EXISTS "users_insert" ON users;

CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (
    -- Inserción normal desde el cliente: admin de la empresa
    (is_admin() AND tenant_id = get_user_tenant_id())
    OR
    -- Inserción desde API Route con x-api-key (project_admin bypassa RLS)
    (auth.role() = 'project_admin')
  );

-- Política de tarifas: igual
DROP POLICY IF EXISTS "tarifas_admin_only" ON tarifas_empleado;

CREATE POLICY "tarifas_admin_only" ON tarifas_empleado FOR ALL
  USING (
    (is_admin() AND tenant_id = get_user_tenant_id())
    OR (auth.role() = 'project_admin')
  )
  WITH CHECK (
    (is_admin() AND tenant_id = get_user_tenant_id())
    OR (auth.role() = 'project_admin')
  );
