-- ──────────────────────────────────────────────────────────────────
-- MIGRACIÓN 004 — Arreglos RLS para asignaciones libres
-- Ejecutar en InsForge → SQL Editor
-- ──────────────────────────────────────────────────────────────────

-- Paso 1: asegurarse de que obra_id puede ser NULL (libre)
ALTER TABLE asignaciones
  ADD COLUMN IF NOT EXISTS es_libre BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE asignaciones
  ALTER COLUMN obra_id DROP NOT NULL;

-- Paso 2: eliminar la UNIQUE constraint original que no acepta NULL en obra_id
ALTER TABLE asignaciones
  DROP CONSTRAINT IF EXISTS asignaciones_obra_id_user_id_fecha_inicio_key;

-- Paso 3: nueva unique constraint que admite obra_id NULL
-- (PostgreSQL trata NULLs como distintos en UNIQUE, así que podemos tener
--  varias filas libre para el mismo user/fecha — tomamos la más reciente por dedup)

-- Paso 4: recrear la política SELECT para admitir obra_id NULL (asignaciones libres)
DROP POLICY IF EXISTS "asignaciones_select" ON asignaciones;

CREATE POLICY "asignaciones_select" ON asignaciones FOR SELECT
  USING (
    CASE
      WHEN obra_id IS NOT NULL THEN
        -- Asignación a obra: verificar que la obra es del tenant del usuario
        EXISTS (
          SELECT 1 FROM obras o
          WHERE o.id = obra_id
            AND o.tenant_id = get_user_tenant_id()
        )
      ELSE
        -- Asignación libre (obra_id NULL): verificar por user_id del tenant
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = user_id
            AND u.tenant_id = get_user_tenant_id()
        )
    END
  );

-- La política INSERT ya era correcta (is_admin()), no hace falta tocarla
