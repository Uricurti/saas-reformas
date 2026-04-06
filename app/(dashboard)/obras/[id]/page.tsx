"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import {
  getObraById,
  updateObra,
  archivarObra,
  createAsignacion,
  deleteAsignacion,
  getUsuariosByTenant,
  getMaterialesByObra,
  getArchivosByObra,
  getDocumentosByObra,
} from "@/lib/insforge/database";
import type { ObraConAsignados, User, Material, Archivo, Documento } from "@/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Building2, MapPin, Calendar, Phone, Users,
  Plus, Trash2, Archive, Edit3, Check, X, Package,
  Image, ChevronRight, Loader2, UserPlus,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DireccionInput } from "@/components/ui/DireccionInput";
import { DireccionLink } from "@/components/ui/DireccionLink";
import { DocumentacionSection } from "@/components/modules/obras/DocumentacionSection";

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function ObraDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const tenantId = useTenantId();
  const user = useAuthStore((s) => s.user);

  const [obra, setObra] = useState<ObraConAsignados | null>(null);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editando, setEditando] = useState(false);

  // Form de edición
  const [formNombre, setFormNombre] = useState("");
  const [formDireccion, setFormDireccion] = useState("");
  const [formCliente, setFormCliente] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formNotas, setFormNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Modal asignar
  const [showAsignarModal, setShowAsignarModal] = useState(false);

  useEffect(() => {
    if (id) cargar();
  }, [id]);

  async function cargar() {
    setIsLoading(true);
    const [obraRes, matsRes, archRes, docsRes] = await Promise.all([
      getObraById(id),
      getMaterialesByObra(id),
      getArchivosByObra(id),
      getDocumentosByObra(id),
    ]);

    if (obraRes.error || !obraRes.data) {
      router.replace("/obras");
      return;
    }

    const obraData = obraRes.data as ObraConAsignados;
    setObra(obraData);
    setFormNombre(obraData.nombre);
    setFormDireccion(obraData.direccion);
    setFormCliente(obraData.cliente_nombre ?? "");
    setFormTelefono(obraData.cliente_telefono ?? "");
    setFormNotas(obraData.notas_internas ?? "");

    setMateriales((matsRes.data as Material[]) ?? []);
    setArchivos((archRes.data as Archivo[]) ?? []);
    setDocumentos((docsRes.data as Documento[]) ?? []);

    if (tenantId) {
      const usersRes = await getUsuariosByTenant(tenantId);
      setUsuarios((usersRes.data as User[]) ?? []);
    }

    setIsLoading(false);
  }

  async function handleGuardarEdicion() {
    if (!obra) return;
    setGuardando(true);
    await updateObra(obra.id, {
      nombre: formNombre,
      direccion: formDireccion,
      cliente_nombre: formCliente || undefined,
      cliente_telefono: formTelefono || undefined,
      notas_internas: formNotas || undefined,
    });
    setEditando(false);
    setGuardando(false);
    cargar();
  }

  async function handleArchivar() {
    if (!obra) return;
    if (!confirm(`¿Archivar la obra "${obra.nombre}"?`)) return;
    await archivarObra(obra.id);
    router.replace("/obras");
  }

  async function handleQuitarAsignacion(asignacionId: string) {
    await deleteAsignacion(asignacionId);
    cargar();
  }

  if (isLoading) return <LoadingSkeleton />;
  if (!obra) return null;

  const asignados = obra.asignaciones ?? [];
  const asignadosIds = new Set(asignados.map((a) => a.user_id));
  const empleadosDisponibles = usuarios.filter((u) => u.rol === "empleado" && !asignadosIds.has(u.id));
  const matsPendientes = materiales.filter((m) => m.estado === "pendiente").length;
  const estadoColor = { activa: "badge-success", pausada: "badge-warning", archivada: "badge-gray" }[obra.estado];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back + título */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {editando ? (
          <input
            value={formNombre}
            onChange={(e) => setFormNombre(e.target.value)}
            className="input text-lg font-bold flex-1 min-w-0"
            placeholder="Nombre de la obra"
          />
        ) : (
          <h1 className="text-lg sm:text-xl font-bold text-content-primary flex-1 min-w-0 truncate">{obra.nombre}</h1>
        )}
        <span className={cn("badge flex-shrink-0", estadoColor)}>{obra.estado}</span>
      </div>

      {/* Info principal */}
      <div className="card p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-semibold text-content-primary text-sm uppercase tracking-wide text-content-muted">Información</h2>
          {isAdmin && !editando && (
            <button onClick={() => setEditando(true)} className="btn-ghost py-1 px-2 text-xs gap-1">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          )}
          {editando && (
            <div className="flex gap-2">
              <button onClick={() => setEditando(false)} className="btn-ghost py-1 px-2 text-xs gap-1">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button onClick={handleGuardarEdicion} disabled={guardando} className="btn-primary py-1 px-3 text-xs gap-1">
                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
            {editando ? (
              <DireccionInput
                value={formDireccion}
                onChange={setFormDireccion}
                className="flex-1"
                placeholder="Dirección de la obra"
              />
            ) : (
              <DireccionLink
                direccion={obra.direccion}
                showExternalIcon
                className="text-sm text-content-primary"
              />
            )}
          </div>

          {(obra.cliente_nombre || editando) && (
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
              {editando ? (
                <input value={formCliente} onChange={(e) => setFormCliente(e.target.value)} className="input flex-1" placeholder="Nombre del cliente (opcional)" />
              ) : (
                <span className="text-sm text-content-primary">{obra.cliente_nombre}</span>
              )}
            </div>
          )}

          {(obra.cliente_telefono || editando) && (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
              {editando ? (
                <input value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} className="input flex-1" placeholder="Teléfono del cliente (opcional)" />
              ) : (
                <span className="text-sm text-content-primary">{obra.cliente_telefono}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-content-muted flex-shrink-0" />
            <span className="text-sm text-content-secondary">
              {format(new Date(obra.fecha_inicio), "d MMM yyyy", { locale: es })}
              {obra.fecha_fin_estimada && (
                <> → {format(new Date(obra.fecha_fin_estimada), "d MMM yyyy", { locale: es })}</>
              )}
            </span>
          </div>

          {(obra.notas_internas || editando) && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-content-muted mb-1">Notas internas</p>
              {editando ? (
                <textarea value={formNotas} onChange={(e) => setFormNotas(e.target.value)} className="input w-full" rows={3} placeholder="Notas, observaciones..." />
              ) : (
                <p className="text-sm text-content-primary whitespace-pre-wrap">{obra.notas_internas}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Equipo asignado */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-content-primary">
            Equipo asignado
            <span className="ml-2 text-sm font-normal text-content-muted">({asignados.length})</span>
          </h2>
          {isAdmin && empleadosDisponibles.length > 0 && (
            <button onClick={() => setShowAsignarModal(true)} className="btn-primary py-1.5 px-3 text-sm gap-1.5">
              <UserPlus className="w-4 h-4" /> Asignar
            </button>
          )}
        </div>

        {asignados.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="icon-container-gray w-12 h-12 mb-3">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm text-content-secondary">Sin trabajadores asignados</p>
            {isAdmin && (
              <button onClick={() => setShowAsignarModal(true)} className="btn-primary mt-3 py-1.5 px-4 text-sm gap-1.5">
                <UserPlus className="w-4 h-4" /> Asignar trabajador
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {asignados.map((asig) => (
              <div key={asig.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {asig.user?.nombre?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary">{asig.user?.nombre}</p>
                  <p className="text-xs text-content-muted">
                    Desde {format(new Date(asig.fecha_inicio), "d MMM yyyy", { locale: es })}
                    {asig.fecha_fin && <> · Hasta {format(new Date(asig.fecha_fin), "d MMM yyyy", { locale: es })}</>}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleQuitarAsignacion(asig.id)}
                    className="btn-ghost p-2 text-danger hover:bg-danger-light"
                    title="Quitar de la obra"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accesos rápidos: Materiales y Fotos */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href={`/materiales?obra=${obra.id}`} className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow active:scale-95">
          <div className="icon-container w-10 h-10">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-content-primary text-sm">Materiales</p>
            <p className="text-xs text-content-muted">{matsPendientes > 0 ? `${matsPendientes} pendiente${matsPendientes > 1 ? "s" : ""}` : `${materiales.length} total`}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-content-muted self-end" />
        </Link>

        <Link href={`/fotos?obra=${obra.id}`} className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow active:scale-95">
          <div className="icon-container w-10 h-10">
            <Image className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-content-primary text-sm">Fotos obra</p>
            <p className="text-xs text-content-muted">{archivos.length > 0 ? `${archivos.length} archivo${archivos.length > 1 ? "s" : ""}` : "Sin fotos"}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-content-muted self-end" />
        </Link>
      </div>

      {/* Documentación */}
      <DocumentacionSection
        obraId={obra.id}
        tenantId={tenantId!}
        userId={user!.id}
        isAdmin={isAdmin}
        documentos={documentos}
        onActualizar={cargar}
      />

      {/* Archivar obra */}
      {isAdmin && obra.estado !== "archivada" && (
        <button onClick={handleArchivar} className="w-full btn-ghost text-warning-foreground border border-warning/30 py-3 gap-2 justify-center">
          <Archive className="w-4 h-4" /> Archivar esta obra
        </button>
      )}

      {/* Modal asignar trabajador */}
      {showAsignarModal && (
        <AsignarModal
          obraId={obra.id}
          empleados={empleadosDisponibles}
          onClose={() => setShowAsignarModal(false)}
          onAsignado={() => { setShowAsignarModal(false); cargar(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal para asignar trabajador
// ─────────────────────────────────────────────────────────────
function AsignarModal({
  obraId,
  empleados,
  onClose,
  onAsignado,
}: {
  obraId: string;
  empleados: User[];
  onClose: () => void;
  onAsignado: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    if (!userId) return;
    setGuardando(true);
    await createAsignacion(obraId, userId, fechaInicio, fechaFin || undefined);
    setGuardando(false);
    onAsignado();
  }

  return (
    <div className="fullscreen-modal" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-content-primary">Asignar trabajador</h3>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Trabajador</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {empleados.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="input" />
          </div>

          <div>
            <label className="label">Fecha fin <span className="text-content-muted font-normal">(opcional)</span></label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input" min={fechaInicio} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleGuardar}
            disabled={!userId || guardando}
            className={cn("btn-primary flex-1 justify-center", (!userId || guardando) && "opacity-60 cursor-not-allowed")}
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Asignar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton de carga
// ─────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
    </div>
  );
}
