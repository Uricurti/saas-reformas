"use client";

import { useEffect, useState } from "react";
import { useTenantId, useIsAdmin, useUser } from "@/lib/stores/auth-store";
import { useRouter } from "next/navigation";
import { getUsuariosByTenant, toggleUsuarioActivo, getTarifaEmpleado, setTarifaEmpleado } from "@/lib/insforge/database";
import { createUser } from "@/lib/insforge/auth";
import type { User } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Users, Plus, UserCheck, UserX, Loader2, X,
  Shield, HardHat, Euro, Edit3, Check, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, formatCurrency } from "@/lib/utils/format";

// ── Tipo extendido con tarifa cargada ─────────────────────────
interface UserConTarifa extends User {
  tarifa_diaria: number;
}

// ─────────────────────────────────────────────────────────────
export default function EquipoPage() {
  const tenantId = useTenantId();
  const isAdmin = useIsAdmin();
  const currentUser = useUser();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<UserConTarifa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCrear, setShowCrear] = useState(false);
  // userId del empleado cuya tarifa se está editando inline
  const [editandoTarifa, setEditandoTarifa] = useState<string | null>(null);
  const [valorTarifa, setValorTarifa] = useState("");
  const [guardandoTarifa, setGuardandoTarifa] = useState(false);

  useEffect(() => {
    if (!isAdmin) router.replace("/obras");
    if (tenantId && isAdmin) cargar();
  }, [isAdmin, tenantId]);

  async function cargar() {
    setIsLoading(true);
    const { data } = await getUsuariosByTenant(tenantId!);
    const users = (data as User[]) ?? [];

    // Cargar tarifas de todos los empleados en paralelo
    const conTarifas: UserConTarifa[] = await Promise.all(
      users.map(async (u) => {
        const tarifa = u.rol === "empleado" ? await getTarifaEmpleado(u.id) : 0;
        return { ...u, tarifa_diaria: tarifa };
      })
    );

    setUsuarios(conTarifas);
    setIsLoading(false);
  }

  async function handleToggleActivo(user: UserConTarifa) {
    if (user.id === currentUser?.id) return;
    await toggleUsuarioActivo(user.id, !user.activo);
    cargar();
  }

  function iniciarEditarTarifa(user: UserConTarifa) {
    setEditandoTarifa(user.id);
    setValorTarifa(user.tarifa_diaria > 0 ? String(user.tarifa_diaria) : "");
  }

  async function guardarTarifa(user: UserConTarifa) {
    if (!tenantId) return;
    setGuardandoTarifa(true);
    const nueva = parseFloat(valorTarifa) || 0;
    await setTarifaEmpleado(user.id, tenantId, nueva);
    setEditandoTarifa(null);
    setGuardandoTarifa(false);
    // Actualizar en local sin recargar todo
    setUsuarios((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, tarifa_diaria: nueva } : u)
    );
  }

  if (!isAdmin) return null;

  const empleados = usuarios.filter((u) => u.rol === "empleado");
  const admins    = usuarios.filter((u) => u.rol === "admin");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Equipo"
        subtitle={`${usuarios.length} persona${usuarios.length !== 1 ? "s" : ""} en la empresa`}
        action={
          <button onClick={() => setShowCrear(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Añadir persona
          </button>
        }
      />

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20" />)}
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Empleados ── */}
          {empleados.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <HardHat className="w-4 h-4 text-content-muted" />
                <h2 className="text-sm font-semibold text-content-muted uppercase tracking-wide">
                  Empleados ({empleados.length})
                </h2>
              </div>

              {/* Cabecera de columnas */}
              <div className="hidden md:grid grid-cols-[1fr_auto_auto] gap-4 px-4 mb-1">
                <span className="text-xs text-content-muted uppercase font-semibold">Nombre</span>
                <span className="text-xs text-content-muted uppercase font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Tarifa / día
                </span>
                <span className="text-xs text-content-muted uppercase font-semibold w-8" />
              </div>

              <div className="space-y-2">
                {empleados.map((user) => (
                  <div
                    key={user.id}
                    className={cn(
                      "card p-4 transition-all",
                      !user.activo && "opacity-60",
                    )}
                  >
                    {/* Fila principal */}
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-content-secondary">{initials(user.nombre)}</span>
                      </div>

                      {/* Nombre + email */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-content-primary">{user.nombre}</p>
                          {!user.activo && <span className="badge badge-danger">Inactivo</span>}
                          {user.id === currentUser?.id && <span className="badge badge-gray">Tú</span>}
                        </div>
                        <p className="text-xs text-content-muted mt-0.5">{user.email}</p>
                      </div>

                      {/* Tarifa — bloque derecho */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {editandoTarifa === user.id ? (
                          /* Edición inline */
                          <div className="flex items-center gap-1.5 animate-fade-in">
                            <div className="relative">
                              <Euro className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                autoFocus
                                value={valorTarifa}
                                onChange={(e) => setValorTarifa(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") guardarTarifa(user);
                                  if (e.key === "Escape") setEditandoTarifa(null);
                                }}
                                className="input pl-7 w-28 py-1.5 text-sm"
                                placeholder="120"
                              />
                            </div>
                            <button
                              onClick={() => guardarTarifa(user)}
                              disabled={guardandoTarifa}
                              className="btn-primary p-1.5"
                              title="Guardar"
                            >
                              {guardandoTarifa
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditandoTarifa(null)}
                              className="btn-ghost p-1.5"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          /* Vista normal */
                          <button
                            onClick={() => iniciarEditarTarifa(user)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:scale-105",
                              user.tarifa_diaria > 0
                                ? "bg-success-light text-success-foreground"
                                : "bg-gray-100 text-content-muted italic",
                            )}
                            title="Editar tarifa diaria"
                          >
                            {user.tarifa_diaria > 0 ? (
                              <>
                                <Euro className="w-3.5 h-3.5" />
                                {formatCurrency(user.tarifa_diaria)}<span className="font-normal text-xs">/día</span>
                              </>
                            ) : (
                              <>
                                <Euro className="w-3.5 h-3.5" />
                                Sin tarifa
                              </>
                            )}
                            <Edit3 className="w-3 h-3 opacity-50" />
                          </button>
                        )}

                        {/* Activar/desactivar */}
                        {user.id !== currentUser?.id && editandoTarifa !== user.id && (
                          <button
                            onClick={() => handleToggleActivo(user)}
                            title={user.activo ? "Desactivar cuenta" : "Activar cuenta"}
                            className={cn(
                              "p-2 rounded-lg transition-colors flex-shrink-0",
                              user.activo
                                ? "text-content-muted hover:bg-danger-light hover:text-danger"
                                : "text-success hover:bg-success-light",
                            )}
                          >
                            {user.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Aviso privacidad */}
              <div className="flex items-start gap-2 mt-3 px-1">
                <Lock className="w-3.5 h-3.5 text-content-muted mt-0.5 flex-shrink-0" />
                <p className="text-xs text-content-muted">
                  Las tarifas son <strong>completamente privadas</strong> — solo visibles para el administrador. Los empleados nunca las ven.
                </p>
              </div>
            </section>
          )}

          {/* ── Administradores ── */}
          {admins.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-content-muted" />
                <h2 className="text-sm font-semibold text-content-muted uppercase tracking-wide">
                  Administradores ({admins.length})
                </h2>
              </div>
              <div className="space-y-2">
                {admins.map((user) => (
                  <div key={user.id} className="card p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{initials(user.nombre)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-content-primary">{user.nombre}</p>
                        <span className="badge badge-primary">
                          <Shield className="w-2.5 h-2.5 inline mr-0.5" />Admin
                        </span>
                        {user.id === currentUser?.id && <span className="badge badge-gray">Tú</span>}
                      </div>
                      <p className="text-xs text-content-muted mt-0.5">{user.email}</p>
                    </div>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleToggleActivo(user)}
                        title={user.activo ? "Desactivar" : "Activar"}
                        className="p-2 rounded-lg text-content-muted hover:bg-danger-light hover:text-danger transition-colors"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showCrear && (
        <CrearUsuarioModal
          tenantId={tenantId!}
          onClose={() => setShowCrear(false)}
          onCreated={() => { setShowCrear(false); cargar(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal crear usuario
// ─────────────────────────────────────────────────────────────
function CrearUsuarioModal({
  tenantId,
  onClose,
  onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "empleado" as "admin" | "empleado",
    tarifa_diaria: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit() {
    if (!form.nombre || !form.email || !form.password) {
      setError("Nombre, email y contraseña son obligatorios.");
      return;
    }
    setIsLoading(true);
    const { error } = await createUser({
      nombre: form.nombre,
      email: form.email,
      password: form.password,
      rol: form.rol,
      tenant_id: tenantId,
      tarifa_diaria: form.tarifa_diaria ? parseFloat(form.tarifa_diaria) : undefined,
    });
    setIsLoading(false);
    if (error) {
      setError(typeof error === "string" ? error : (error as any)?.message ?? "Error al crear usuario");
    } else {
      onCreated();
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="icon-container w-9 h-9"><Users className="w-4 h-4" /></div>
            <h2 className="text-lg font-semibold">Añadir persona al equipo</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="label">Nombre completo *</label>
            <input className="input" placeholder="Juan García" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="juan@tuempresa.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className="label">Contraseña temporal *</label>
            <input className="input" type="text" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => set("password", e.target.value)} />
            <p className="text-xs text-content-muted mt-1">Pásale esta contraseña por WhatsApp.</p>
          </div>
          <div>
            <label className="label">Rol</label>
            <div className="grid grid-cols-2 gap-3">
              {(["empleado", "admin"] as const).map((r) => (
                <button key={r} type="button" onClick={() => set("rol", r)}
                  className={cn("p-3 rounded-xl border-2 text-sm font-medium transition-all",
                    form.rol === r ? "border-primary bg-primary-light text-primary" : "border-border text-content-secondary")}>
                  {r === "admin" ? "🔑 Admin" : "👷 Empleado"}
                </button>
              ))}
            </div>
          </div>
          {form.rol === "empleado" && (
            <div>
              <label className="label flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-content-muted" />
                Tarifa diaria (€/día)
                <span className="text-content-muted font-normal text-xs ml-1">— solo admin</span>
              </label>
              <div className="relative">
                <Euro className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
                <input
                  className="input pl-9"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="120"
                  value={form.tarifa_diaria}
                  onChange={(e) => set("tarifa_diaria", e.target.value)}
                />
              </div>
              <p className="text-xs text-content-muted mt-1">
                Solo visible para administradores. Se usa para calcular los jornales mensuales.
              </p>
            </div>
          )}
          {error && <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3">{error}</div>}
        </div>

        <div className="p-5 border-t border-border flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="btn-primary">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}
