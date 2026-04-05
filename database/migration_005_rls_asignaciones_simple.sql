-- ──────────────────────────────────────────────────────────────────
-- MIGRACIÓN 005 — Simplificar política SELECT de asignaciones
-- Problema: la política original hace JOIN a obras(obra_id), y cuando
--           obra_id es NULL (empleado libre), ese JOIN no devuelve nada
--           y bloquea tanto el SELECT como el INSERT.
-- Solución: comprobar tenant siempre a través de user_id → users.tenant_id
--           (funciona igual de bien y no depende de obra_id).
-- Ejecutar en InsForge → SQL Editor
-- ──────────────────────────────────────────────────────────────────

-- 1. Eliminar todas las políticas SELECT existentes sobre asignaciones
DROP POLICY IF EXISTS "asignaciones_select"  ON asignaciones;
DROP POLICY IF EXISTS "asignaciones_select2" ON asignaciones;

-- 2. Nueva política: siempre comprueba tenant a través del user_id
--    → válida tanto si obra_id tiene valor como si es NULL (libre)
CREATE POLICY "asignaciones_select" ON asignaciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id    = asignaciones.user_id
        AND u.tenant_id = get_user_tenant_id()
    )
  );

-- 3. Asegurarse de que obra_id puede ser NULL (por si la migración 003/004
--    no se aplicó del todo)
ALTER TABLE asignaciones
  ALTER COLUMN obra_id DROP NOT NULL;

-- 4. Añadir es_libre si no existe
ALTER TABLE asignaciones
  ADD COLUMN IF NOT EXISTS es_libre BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Eliminar la unique constraint original (no admite NULL correctamente)
ALTER TABLE asignaciones
  DROP CONSTRAINT IF EXISTS asignaciones_obra_id_user_id_fecha_inicio_key;
