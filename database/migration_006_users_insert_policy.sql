-- ──────────────────────────────────────────────────────────────────
-- MIGRACIÓN 006 — Permitir al service key crear usuarios
-- Problema: la política users_insert requiere is_admin() pero con el
--           service key auth.uid() es null y is_admin() devuelve false.
-- Solución: permitir también cuando el rol es 'service_role'.
-- Ejecutar en InsForge → SQL Editor
-- ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_insert" ON users;

CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (
    -- Inserción normal: admin de la misma empresa
    (is_admin() AND tenant_id = get_user_tenant_id())
    OR
    -- Inserción desde API Route con service key (crear empleados)
    (auth.role() = 'service_role')
  );

-- Lo mismo para tarifas_empleado (también se inserta desde la API Route)
DROP POLICY IF EXISTS "tarifas_admin_only" ON tarifas_empleado;

CREATE POLICY "tarifas_admin_only" ON tarifas_empleado FOR ALL
  USING (
    (is_admin() AND tenant_id = get_user_tenant_id())
    OR (auth.role() = 'service_role')
  )
  WITH CHECK (
    (is_admin() AND tenant_id = get_user_tenant_id())
    OR (auth.role() = 'service_role')
  );
