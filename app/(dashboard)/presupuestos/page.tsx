"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getPresupuestos, duplicarPresupuesto, getPresupuestoById, deletePresupuesto } from "@/lib/insforge/database";
import type { Presupuesto, PresupuestoConLineas } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { PresupuestoCard } from "@/components/modules/presupuestos/PresupuestoCard";
import { NuevoPresupuestoModal } from "@/components/modules/presupuestos/NuevoPresupuestoModal";
import { EditarPresupuestoModal } from "@/components/modules/presupuestos/EditarPresupuestoModal";
import { PresupuestoPreview } from "@/components/modules/presupuestos/PresupuestoPreview";
import { GestorCatalogo } from "@/components/modules/presupuestos/GestorCatalogo";
import { PresupuestoAObraModal } from "@/components/modules/presupuestos/PresupuestoAObraModal";
import {
  Plus, Settings2, Loader2, Search, X, ChevronDown, FileText,
} from "lucide-react";

const ESTADO_OPTS = [
  { value: "",          label: "Todos los estados" },
  { value: "borrador",  label: "Borrador" },
  { value: "enviado",   label: "Enviado" },
  { value: "aceptado",  label: "Aceptado" },
  { value: "rechazado", label: "Rechazado" },
];

const TIPO_OPTS = [
  { value: "",       label: "Todos los tipos" },
  { value: "bano",   label: "Baño" },
  { value: "cocina", label: "Cocina" },
  { value: "otros",  label: "Otros" },
];

export default function PresupuestosPage() {
  const router   = useRouter();
  const user     = useAuthStore((s) => s.user);
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  // Redirect non-admins
  useEffect(() => {
    if (isAdmin === false) router.replace("/dashboard");
  }, [isAdmin, router]);

  // Data
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [cargando,     setCargando]     = useState(true);

  // Filtros
  const [busqueda, setBusqueda]   = useState("");
  const [estado,   setEstado]     = useState("");
  const [tipo,     setTipo]       = useState("");
  const [showFiltros, setShowFiltros] = useState(false);

  // Modals
  const [showNuevo,   setShowNuevo]   = useState(false);
  const [editarId,    setEditarId]    = useState<string | null>(null);
  const [previewPres, setPreviewPres] = useState<PresupuestoConLineas | null>(null);
  const [loadingPDF,  setLoadingPDF]  = useState<string | null>(null);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [obraModal,   setObraModal]   = useState<Presupuesto | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setCargando(true);
    const data = await getPresupuestos(tenantId, {
      estado:    estado    || undefined,
      tipo:      tipo      || undefined,
      busqueda:  busqueda  || undefined,
    });
    setPresupuestos(data);
    setCargando(false);
  }, [tenantId, estado, tipo, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleVerPDF(id: string) {
    setLoadingPDF(id);
    const data = await getPresupuestoById(id);
    setLoadingPDF(null);
    if (data) setPreviewPres(data);
  }

  async function handleDuplicar(id: string) {
    if (!tenantId || !user) return;
    await duplicarPresupuesto(id, tenantId);
    cargar();
  }

  async function handleEliminar(id: string) {
    await deletePresupuesto(id);
    cargar();
  }

  if (!isAdmin) return null;

  // Stats rápidas
  const total     = presupuestos.length;
  const aceptados = presupuestos.filter((p) => p.estado === "aceptado").length;
  const enviados  = presupuestos.filter((p) => p.estado === "enviado").length;
  const importeTotal = presupuestos
    .filter((p) => p.estado === "aceptado")
    .reduce((s, p) => s + p.importe_total, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Presupuestos"
        subtitle={`${total} presupuesto${total !== 1 ? "s" : ""}${aceptados > 0 ? ` · ${aceptados} aceptado${aceptados !== 1 ? "s" : ""}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCatalogo(true)}
              className="btn-secondary text-sm"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Catálogo</span>
            </button>
            <button
              onClick={() => setShowNuevo(true)}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo</span>
            </button>
          </div>
        }
      />

      {/* Stats rápidas */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total",     value: total,    color: "#607eaa" },
            { label: "Enviados",  value: enviados,  color: "#3b82f6" },
            { label: "Aceptados", value: aceptados, color: "#10b981" },
            { label: "Facturado", value: importeTotal.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €", color: "#1A1A2E" },
          ].map((s) => (
            <div key={s.label} className="card p-5 text-center">
              <p className="text-xs text-content-muted font-medium uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-black mt-2" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input
              className="input pl-9 text-sm"
              placeholder="Buscar por cliente, dirección, número..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-content-muted" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`btn-ghost text-sm flex-shrink-0 ${(estado || tipo) ? "text-primary" : ""}`}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showFiltros ? "rotate-180" : ""}`} />
            Filtros {(estado || tipo) && <span className="w-1.5 h-1.5 bg-primary rounded-full" />}
          </button>
        </div>

        {showFiltros && (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="input text-sm py-1.5 flex-1 min-w-[140px]"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {ESTADO_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="input text-sm py-1.5 flex-1 min-w-[140px]"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              {TIPO_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {(estado || tipo) && (
              <button
                onClick={() => { setEstado(""); setTipo(""); }}
                className="btn-ghost text-xs text-danger"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : presupuestos.length === 0 ? (
        <div className="card p-10 sm:p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-5">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-content-primary mb-2">
            {busqueda || estado || tipo ? "Sin resultados" : "Sin presupuestos"}
          </h3>
          <p className="text-sm text-content-secondary mb-8 max-w-sm mx-auto">
            {busqueda || estado || tipo
              ? "Prueba con otros filtros o términos de búsqueda."
              : "Crea tu primer presupuesto para empezar a gestionar los presupuestos de tus clientes."}
          </p>
          {!busqueda && !estado && !tipo && (
            <button onClick={() => setShowNuevo(true)} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Nuevo presupuesto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {presupuestos.map((p) => (
            <PresupuestoCard
              key={p.id}
              presupuesto={p}
              onVerPDF={(id) => handleVerPDF(id)}
              onEditar={(id) => setEditarId(id)}
              onDuplicar={(id) => handleDuplicar(id)}
              onCrearObra={(id) => {
                const found = presupuestos.find((x) => x.id === id);
                if (found) setObraModal(found);
              }}
              onEliminar={handleEliminar}
              onUpdate={cargar}
            />
          ))}
        </div>
      )}

      {/* Loading PDF overlay */}
      {loadingPDF && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-content-primary">Cargando presupuesto...</span>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showNuevo && tenantId && user && (
        <NuevoPresupuestoModal
          tenantId={tenantId}
          userId={user.id}
          onClose={() => setShowNuevo(false)}
          onCreated={() => { setShowNuevo(false); cargar(); }}
        />
      )}

      {editarId && tenantId && user && (
        <EditarPresupuestoModal
          presupuestoId={editarId}
          tenantId={tenantId}
          onClose={() => setEditarId(null)}
          onUpdated={() => { setEditarId(null); cargar(); }}
        />
      )}

      {previewPres && tenantId && (
        <PresupuestoPreview
          presupuesto={previewPres}
          tenantId={tenantId}
          onClose={() => setPreviewPres(null)}
        />
      )}

      {showCatalogo && tenantId && (
        <GestorCatalogo
          tenantId={tenantId}
          onClose={() => setShowCatalogo(false)}
        />
      )}

      {obraModal && tenantId && user && (
        <PresupuestoAObraModal
          presupuesto={obraModal}
          tenantId={tenantId}
          userId={user.id}
          onClose={() => setObraModal(null)}
          onCreada={() => { setObraModal(null); cargar(); }}
        />
      )}
    </div>
  );
}
