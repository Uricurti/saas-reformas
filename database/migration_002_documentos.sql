-- ──────────────────────────────────────────────────────────────────
-- MIGRACIÓN 002 — Tabla documentos (planos, PDFs, etc.)
-- Ejecutar en InsForge → SQL Editor
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documentos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id       UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  nombre        TEXT NOT NULL,           -- nombre original del archivo
  categoria     TEXT NOT NULL DEFAULT 'otro',
                                         -- 'plano', 'medidas', 'presupuesto',
                                         -- 'contrato', 'foto', 'otro'
  url_storage   TEXT NOT NULL,
  tamano_bytes  BIGINT DEFAULT 0,
  descripcion   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_documentos_obra    ON documentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tenant  ON documentos(tenant_id);

-- RLS
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- Empleados y admins del mismo tenant pueden leer
CREATE POLICY "tenant_read_documentos" ON documentos
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Solo el uploader o admin puede insertar
CREATE POLICY "tenant_insert_documentos" ON documentos
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Solo admin puede eliminar
CREATE POLICY "admin_delete_documentos" ON documentos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND tenant_id = documentos.tenant_id
        AND rol = 'admin'
    )
  );
