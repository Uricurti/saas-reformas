-- ──────────────────────────────────────────────────────────────────
-- MIGRACIÓN 003 — Campo es_libre en asignaciones
-- Ejecutar en InsForge → SQL Editor
-- ──────────────────────────────────────────────────────────────────

-- Añadir columna es_libre (día libre / no trabaja)
ALTER TABLE asignaciones
  ADD COLUMN IF NOT EXISTS es_libre BOOLEAN NOT NULL DEFAULT FALSE;

-- Permitir obra_id nulo (cuando es_libre = true no hace falta obra)
ALTER TABLE asignaciones
  ALTER COLUMN obra_id DROP NOT NULL;
