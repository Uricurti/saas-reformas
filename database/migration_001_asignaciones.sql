-- Migración 001: añadir hora_inicio y nota a asignaciones
-- Ejecutar en el SQL editor de InsForge dashboard

ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS hora_inicio TEXT;
ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS nota       TEXT;
