"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import {
  getObraById,
  updateObra,
  archivarObra,
  deleteObra,
  iniciarObra,
  pausarObra,
  reanudarObra,
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
  Image, ChevronRight, ChevronDown, Loader2, UserPlus, FileText,
  Play, Pause, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DireccionInput } from "@/components/ui/DireccionInput";
import { DireccionLink } from "@/components/ui/DireccionLink";
import { DocumentacionSection } from "@/components/modules/obras/DocumentacionSection";
import { FacturacionSection } from "@/components/modules/obras/FacturacionSection";

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
  const [formNombre,        setFormNombre]        = useState("");
  const [formDireccion,     setFormDireccion]     = useState("");
  const [formCodigoPostal,  setFormCodigoPostal]  = useState("");
  const [formPoblacion,     setFormPoblacion]     = useState("");
  const [formCliente,       setFormCliente]       = useState("");
  const [formTelefono,      setFormTelefono]      = useState("");
  const [formDni,           setFormDni]           = useState("");
  const [formNotas,         setFormNotas]         = useState("");
  const [guardando,         setGuardando]         = useState(false);

  // Acordeones
  const [infoAbierto,   setInfoAbierto]   = useState(false);
  const [equipoAbierto, setEquipoAbierto] = useState(false);
  const [docsAbierto,   setDocsAbierto]   = useState(false);

  // Modal asignar
  const [showAsignarModal, setShowAsignarModal] = useState(false);

  // Modal eliminar obra (doble confirmación)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep,      setDeleteStep]      = useState<1 | 2>(1);
  const [eliminando,      setEliminando]      = useState(false);
  const [deleteError,     setDeleteError]     = useState<string | null>(null);

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
    setFormCodigoPostal((obraData as any).codigo_postal ?? "");
    setFormPoblacion((obraData as any).poblacion ?? "");
    setFormCliente(obraData.cliente_nombre ?? "");
    setFormTelefono(obraData.cliente_telefono ?? "");
    setFormDni((obraData as any).cliente_dni_nie_cif ?? "");
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
      nombre:              formNombre,
      direccion:           formDireccion,
      codigo_postal:       formCodigoPostal || undefined,
      poblacion:           formPoblacion || undefined,
      cliente_nombre:      formCliente || undefined,
      cliente_telefono:    formTelefono || undefined,
      cliente_dni_nie_cif: formDni || undefined,
      notas_internas:      formNotas || undefined,
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

  async function handleIniciarObra() {
    if (!obra) return;
    await iniciarObra(obra.id);
    cargar();
  }

  async function handlePausarObra() {
    if (!obra) return;
    await pausarObra(obra.id);
    cargar();
  }

  async function handleReanudarObra() {
    if (!obra) return;
    await reanudarObra(obra.id);
    cargar();
  }

  async function handleQuitarAsignacion(asignacionId: string) {
    await deleteAsignacion(asignacionId);
    cargar();
  }

  async function handleEliminarObra() {
    if (!obra) return;
    setEliminando(true);
    setDeleteError(null);
    const { error } = await deleteObra(obra.id);
    setEliminando(false);
    if (error) { setDeleteError(error); return; }
    router.replace("/obras");
  }

  if (isLoading) return <LoadingSkeleton />;
  if (!obra) return null;

  const asignados = obra.asignaciones ?? [];
  const asignadosIds = new Set(asignados.map((a) => a.user_id));
  const empleadosDisponibles = usuarios.filter((u) => u.rol === "empleado" && !asignadosIds.has(u.id));
  const matsPendientes = materiales.filter((m) => m.estado === "pendiente").length;
  const estadoConfig: Record<string, { cls: string; label: string }> = {
    activa:    { cls: "badge-success", label: "Activa" },
    pausada:   { cls: "badge-warning", label: "Pausada" },
    proxima:   { cls: "badge-blue",    label: "Próxima" },
    archivada: { cls: "badge-gray",    label: "Archivada" },
  };
  const { cls: estadoColor, label: estadoLabel } = estadoConfig[obra.estado] ?? { cls: "badge-gray", label: obra.estado };

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
        <span className={cn("badge flex-shrink-0", estadoColor)}>{estadoLabel}</span>
      </div>

      {/* Info principal — acordeón */}
      <div className="card mb-4 overflow-hidden">
        <button
          onClick={() => !editando && setInfoAbierto((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2F8" }}>
              <Building2 className="w-4 h-4" style={{ color: "#607eaa" }} />
            </div>
            <div>
              <span className="font-semibold text-content-primary text-sm">Información</span>
              {obra.cliente_nombre && (
                <span className="ml-2 text-xs text-content-muted">{obra.cliente_nombre}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && infoAbierto && !editando && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditando(true); }}
                className="btn-ghost py-1 px-2 text-xs gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            {editando && (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setEditando(false)} className="btn-ghost py-1 px-2 text-xs gap-1">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
                <button onClick={handleGuardarEdicion} disabled={guardando} className="btn-primary py-1 px-3 text-xs gap-1">
                  {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Guardar
                </button>
              </div>
            )}
            {!editando && (
              <ChevronDown
                className="w-4 h-4 text-content-muted transition-transform duration-200"
                style={{ transform: infoAbierto ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            )}
          </div>
        </button>

        {(infoAbierto || editando) && (
          <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
            {/* Dirección + CP + Población */}
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
              {editando ? (
                <div className="flex-1 space-y-2">
                  <DireccionInput value={formDireccion} onChange={setFormDireccion} placeholder="Dirección de la obra" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={formCodigoPostal} onChange={(e) => setFormCodigoPostal(e.target.value)} className="input text-sm" placeholder="Código postal" maxLength={10} />
                    <input value={formPoblacion} onChange={(e) => setFormPoblacion(e.target.value)} className="input text-sm" placeholder="Población" />
                  </div>
                </div>
              ) : (
                <div>
                  <DireccionLink direccion={obra.direccion} showExternalIcon className="text-sm text-content-primary" />
                  {((obra as any).codigo_postal || (obra as any).poblacion) && (
                    <span className="text-xs text-content-muted"> · {[(obra as any).codigo_postal, (obra as any).poblacion].filter(Boolean).join(" ")}</span>
                  )}
                </div>
              )}
            </div>

            {(obra.cliente_nombre || editando) && (
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
                {editando ? (
                  <input value={formCliente} onChange={(e) => setFormCliente(e.target.value)} className="input flex-1" placeholder="Nombre y apellidos del cliente" />
                ) : (
                  <span className="text-sm text-content-primary">{obra.cliente_nombre}</span>
                )}
              </div>
            )}

            {((obra as any).cliente_dni_nie_cif || editando) && (
              <div className="flex items-start gap-3">
                <span className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold" style={{ color: "#9CA3AF" }}>ID</span>
                {editando ? (
                  <input value={formDni} onChange={(e) => setFormDni(e.target.value.toUpperCase())} className="input flex-1" placeholder="DNI / NIE / CIF del cliente" />
                ) : (
                  <span className="text-sm text-content-primary">{(obra as any).cliente_dni_nie_cif}</span>
                )}
              </div>
            )}

            {(obra.cliente_telefono || editando) && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
                {editando ? (
                  <input value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} className="input flex-1" placeholder="Teléfono del cliente" type="tel" />
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

      {/* Equipo asignado — acordeón */}
      <div className="card mb-4 overflow-hidden">
        <button
          onClick={() => setEquipoAbierto((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2F8" }}>
              <Users className="w-4 h-4" style={{ color: "#607eaa" }} />
            </div>
            <div>
              <span className="font-semibold text-content-primary text-sm">Equipo asignado</span>
              <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#EEF2F8", color: "#607eaa" }}>
                {asignados.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && empleadosDisponibles.length > 0 && equipoAbierto && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAsignarModal(true); }}
                className="btn-primary py-1 px-2.5 text-xs gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" /> Asignar
              </button>
            )}
            <ChevronDown
              className="w-4 h-4 text-content-muted transition-transform duration-200"
              style={{ transform: equipoAbierto ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </div>
        </button>

        {equipoAbierto && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            {asignados.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <p className="text-sm text-content-secondary mb-3">Sin trabajadores asignados</p>
                {isAdmin && (
                  <button onClick={() => setShowAsignarModal(true)} className="btn-primary py-1.5 px-4 text-sm gap-1.5">
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
                      <button onClick={() => handleQuitarAsignacion(asig.id)} className="btn-ghost p-2 text-danger hover:bg-danger-light" title="Quitar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documentación — acordeón */}
      <div className="card mb-4 overflow-hidden">
        <button
          onClick={() => setDocsAbierto((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2F8" }}>
              <FileText className="w-4 h-4" style={{ color: "#607eaa" }} />
            </div>
            <div>
              <span className="font-semibold text-content-primary text-sm">Documentación</span>
              <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#EEF2F8", color: "#607eaa" }}>
                {documentos.length}
              </span>
            </div>
          </div>
          <ChevronDown
            className="w-4 h-4 text-content-muted transition-transform duration-200"
            style={{ transform: docsAbierto ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {docsAbierto && (
          <div className="border-t border-border">
            <DocumentacionSection
              obraId={obra.id}
              tenantId={tenantId!}
              userId={user!.id}
              isAdmin={isAdmin}
              documentos={documentos}
              onActualizar={cargar}
              embedded
            />
          </div>
        )}
      </div>

      {/* Facturación (solo admin) */}
      {isAdmin && tenantId && (
        <div className="mt-2 p-4 bg-white rounded-2xl border border-surface-border">
          <FacturacionSection obraId={obra.id} tenantId={tenantId} />
        </div>
      )}

      {/* Acciones de estado — solo admin */}
      {isAdmin && obra.estado !== "archivada" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>

          {/* Próxima → Iniciar */}
          {obra.estado === "proxima" && (
            <button
              onClick={handleIniciarObra}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer",
                background: "#D1FAE5", color: "#065F46", fontSize: 14, fontWeight: 700,
              }}
            >
              <Play style={{ width: 16, height: 16 }} />
              Iniciar obra
            </button>
          )}

          {/* Activa → Pausar */}
          {obra.estado === "activa" && (
            <button
              onClick={handlePausarObra}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "13px 0", borderRadius: 12, cursor: "pointer",
                background: "transparent", color: "#92400E", fontSize: 14, fontWeight: 600,
                border: "1.5px solid #FDE68A",
              }}
            >
              <Pause style={{ width: 16, height: 16 }} />
              Pausar obra
            </button>
          )}

          {/* Pausada → Reanudar */}
          {obra.estado === "pausada" && (
            <button
              onClick={handleReanudarObra}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer",
                background: "#EEF2F8", color: "#1c3879", fontSize: 14, fontWeight: 700,
              }}
            >
              <RotateCcw style={{ width: 16, height: 16 }} />
              Reanudar obra
            </button>
          )}

          {/* Archivar — siempre disponible si no archivada */}
          <button
            onClick={handleArchivar}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "13px 0", borderRadius: 12, cursor: "pointer",
              background: "transparent", color: "#6b7280", fontSize: 14, fontWeight: 600,
              border: "1.5px solid #e5e7eb",
            }}
          >
            <Archive style={{ width: 16, height: 16 }} />
            Archivar esta obra
          </button>

          {/* Eliminar — acción destructiva, solo admin */}
          <button
            onClick={() => { setDeleteStep(1); setDeleteError(null); setShowDeleteModal(true); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "13px 0", borderRadius: 12, cursor: "pointer",
              background: "transparent", color: "#dc2626", fontSize: 14, fontWeight: 600,
              border: "1.5px solid #fecaca",
            }}
          >
            <Trash2 style={{ width: 16, height: 16 }} />
            Eliminar obra
          </button>
        </div>
      )}

      {/* Modal doble confirmación — eliminar obra */}
      {showDeleteModal && obra && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} onClick={() => !eliminando && setShowDeleteModal(false)} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

            {/* Paso 1: primera advertencia */}
            {deleteStep === 1 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 style={{ width: 22, height: 22, color: "#dc2626" }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Eliminar obra</h3>
                    <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{obra.nombre}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 1.5 }}>
                  ¿Seguro que quieres eliminar esta obra? Se borrarán también sus empleados asignados, materiales, fotos y facturas.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowDeleteModal(false)}
                    style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={() => setDeleteStep(2)}
                    style={{ flex: 1, background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fecaca", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    Confirmar
                  </button>
                </div>
              </>
            )}

            {/* Paso 2: confirmación final irreversible */}
            {deleteStep === 2 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 style={{ width: 22, height: 22, color: "#fff" }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#dc2626" }}>Confirmación final</h3>
                    <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Esta acción no se puede deshacer</p>
                  </div>
                </div>
                <div style={{ background: "#fff7f7", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>
                  <strong>Se eliminará permanentemente:</strong>
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 16 }}>
                    <li>La obra <strong>"{obra.nombre}"</strong></li>
                    <li>Todas las asignaciones de empleados</li>
                    <li>Jornadas, materiales, fotos y documentos</li>
                    <li>Facturas y pagos asociados</li>
                  </ul>
                </div>
                {deleteError && (
                  <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>⚠️ {deleteError}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowDeleteModal(false)} disabled={eliminando}
                    style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: eliminando ? "default" : "pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={handleEliminarObra} disabled={eliminando}
                    style={{ flex: 1, background: eliminando ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: eliminando ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {eliminando ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Eliminando…</> : "Confirmar y eliminar todo"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal asignar trabajador */}
      {showAsignarModal && (
        <AsignarModal
          obraId={obra.id}
          obraNombre={obra.nombre}
          obraDireccion={obra.direccion}
          tenantId={tenantId!}
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
  obraNombre,
  obraDireccion,
  tenantId,
  empleados,
  onClose,
  onAsignado,
}: {
  obraId: string;
  obraNombre: string;
  obraDireccion: string;
  tenantId: string;
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

    // Trigger email notificación (no bloqueante)
    fetch("/api/notifications/asignacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        userId,
        obraId,
        fechaInicio,
        fechaFin: fechaFin || null,
      }),
    }).catch(() => { /* silent */ });

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
