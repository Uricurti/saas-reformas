-- ══════════════════════════════════════════════════════════════════════════
-- SCHEMA — App Gestión de Reformas
-- Base de datos: InsForge.dev (PostgreSQL)
-- Cómo ejecutar: pega este SQL en el SQL Editor de InsForge
-- ══════════════════════════════════════════════════════════════════════════

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. TENANTS (empresas) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. USERS ─────────────────────────────────────────────────────────────
-- NOTA: InsForge gestiona la autenticación. Esta tabla extiende el perfil.
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY, -- coincide con auth.users.id de InsForge
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  rol           TEXT NOT NULL DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. OBRAS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS obras (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  direccion            TEXT NOT NULL,
  cliente_nombre       TEXT,
  cliente_telefono     TEXT,
  fecha_inicio         DATE NOT NULL,
  fecha_fin_estimada   DATE,
  estado               TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada', 'archivada')),
  notas_internas       TEXT,
  created_by           UUID NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. ASIGNACIONES (quién va a qué obra y cuándo) ───────────────────────
CREATE TABLE IF NOT EXISTS asignaciones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id       UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, user_id, fecha_inicio)
);

-- ─── 5. FICHAJES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fichajes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  obra_id             UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  obra_asignada_id    UUID REFERENCES obras(id), -- obra original si hubo cambio
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fecha               DATE NOT NULL,
  estado              TEXT NOT NULL CHECK (estado IN ('trabajando', 'baja', 'permiso', 'vacaciones', 'otro')),
  hora_registro       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sincronizado        BOOLEAN NOT NULL DEFAULT TRUE,
  es_cambio_obra      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fecha) -- un fichaje por persona por día
);

-- ─── 6. MATERIALES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materiales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id         UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  solicitado_por  UUID NOT NULL REFERENCES users(id),
  descripcion     TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'otro'
                  CHECK (categoria IN ('electricidad', 'fontaneria', 'albanileria', 'pintura', 'carpinteria', 'otro')),
  cantidad        NUMERIC NOT NULL DEFAULT 1,
  unidad          TEXT NOT NULL DEFAULT 'unidad',
  urgencia        TEXT NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('normal', 'urgente')),
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'comprado', 'entregado')),
  nota            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comprado_at     TIMESTAMPTZ
);

-- ─── 7. ARCHIVOS (fotos/vídeos) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id         UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'video')),
  url_storage     TEXT NOT NULL,
  url_thumbnail   TEXT,
  descripcion     TEXT,
  tamano_bytes    BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. TARIFAS EMPLEADO (solo admin puede leer) ──────────────────────────
CREATE TABLE IF NOT EXISTS tarifas_empleado (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tarifa_diaria NUMERIC(10,2) NOT NULL,
  fecha_desde   DATE NOT NULL,
  fecha_hasta   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. NOTIFICACIONES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('asignacion_nueva', 'asignacion_cambio', 'material_pedido', 'fichaje_pendiente', 'foto_subida')),
  leida       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- ÍNDICES — para consultas frecuentes
-- ══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_obras_tenant      ON obras(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_user ON asignaciones(user_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_asignaciones_obra ON asignaciones(obra_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_user_fecha ON fichajes(user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_fichajes_tenant_fecha ON fichajes(tenant_id, fecha);
CREATE INDEX IF NOT EXISTS idx_materiales_obra   ON materiales(obra_id, estado);
CREATE INDEX IF NOT EXISTS idx_materiales_tenant ON materiales(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_archivos_obra     ON archivos(obra_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notificaciones(user_id, leida, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — control de acceso a nivel de fila
-- ══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
ALTER TABLE tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichajes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas_empleado  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones    ENABLE ROW LEVEL SECURITY;

-- Helper: obtener tenant_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS TEXT AS $$
  SELECT rol FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: saber si el usuario actual es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT rol = 'admin' FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Users: cada uno ve los de su empresa; solo admin puede editar
CREATE POLICY "users_select" ON users FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (is_admin() AND tenant_id = get_user_tenant_id());

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- ── Obras: todos ven las activas de su empresa; solo admin crea/edita
CREATE POLICY "obras_select" ON obras FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "obras_insert" ON obras FOR INSERT
  WITH CHECK (is_admin() AND tenant_id = get_user_tenant_id());

CREATE POLICY "obras_update" ON obras FOR UPDATE
  USING (is_admin() AND tenant_id = get_user_tenant_id());

-- ── Asignaciones: todos ven las de su empresa
CREATE POLICY "asignaciones_select" ON asignaciones FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM obras o WHERE o.id = obra_id AND o.tenant_id = get_user_tenant_id())
  );

CREATE POLICY "asignaciones_insert" ON asignaciones FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "asignaciones_update" ON asignaciones FOR UPDATE
  USING (is_admin());

CREATE POLICY "asignaciones_delete" ON asignaciones FOR DELETE
  USING (is_admin());

-- ── Fichajes: cada empleado ve/crea los suyos; admin ve todos los de su empresa
CREATE POLICY "fichajes_select" ON fichajes FOR SELECT
  USING (
    tenant_id = get_user_tenant_id()
    AND (user_id = auth.uid() OR is_admin())
  );

CREATE POLICY "fichajes_insert" ON fichajes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = get_user_tenant_id()
  );

CREATE POLICY "fichajes_update" ON fichajes FOR UPDATE
  USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

-- ── Materiales: todos ven los de su empresa; cualquiera puede pedir
CREATE POLICY "materiales_select" ON materiales FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "materiales_insert" ON materiales FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "materiales_update" ON materiales FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "materiales_delete" ON materiales FOR DELETE
  USING (is_admin() AND tenant_id = get_user_tenant_id());

-- ── Archivos: todos ven los de su empresa; cada uno sube los suyos
CREATE POLICY "archivos_select" ON archivos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "archivos_insert" ON archivos FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "archivos_delete" ON archivos FOR DELETE
  USING (is_admin() AND tenant_id = get_user_tenant_id());

-- ── Tarifas: SOLO admin puede leer y modificar — empleado NUNCA accede
CREATE POLICY "tarifas_admin_only" ON tarifas_empleado FOR ALL
  USING (is_admin() AND tenant_id = get_user_tenant_id());

-- ── Notificaciones: cada usuario solo ve las suyas
CREATE POLICY "notif_select" ON notificaciones FOR SELECT
  USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "notif_update" ON notificaciones FOR UPDATE
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════
-- DATOS INICIALES DE EJEMPLO (opcional, para pruebas)
-- ══════════════════════════════════════════════════════════════════════════
-- Descomentar para insertar un tenant de prueba:

-- INSERT INTO tenants (id, nombre, plan) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Reformas Demo SL', 'basic');
