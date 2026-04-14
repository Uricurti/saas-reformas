"use client";

import { useEffect, useState } from "react";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getObrasActivas, getObrasArchivadas } from "@/lib/insforge/database";
import { getAsignacionHoyByUser } from "@/lib/insforge/database";
import type { ObraConAsignados, Obra } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ObraCard } from "@/components/modules/obras/ObraCard";
import { ObraEmpleadoCard } from "@/components/modules/obras/ObraEmpleadoCard";
import { CrearObraModal } from "@/components/modules/obras/CrearObraModal";
import { Building2, Plus, Archive, Clock, ChevronDown, ChevronUp } from "lucide-react";

export default function ObrasPage() {
  const user      = useAuthStore((s) => s.user);
  const isAdmin   = useIsAdmin();
  const tenantId  = useTenantId();

  const [obras,         setObras]         = useState<ObraConAsignados[]>([]);
  const [archivadas,    setArchivadas]    = useState<ObraConAsignados[]>([]);
  const [obraHoy,       setObraHoy]       = useState<Obra | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [showCrearModal,setShowCrearModal]= useState(false);

  // Collapsibles
  const [proximasOpen,  setProximasOpen]  = useState(true);
  const [archivadasOpen,setArchivadasOpen]= useState(false);

  useEffect(() => { if (tenantId) cargar(); }, [tenantId]);
  useRefreshOnFocus(() => { if (tenantId) cargar(); });

  async function cargar() {
    setIsLoading(true);
    try {
      if (isAdmin) {
        const [activasRes, archRes] = await Promise.all([
          getObrasActivas(tenantId!),
          getObrasArchivadas(tenantId!),
        ]);
        setObras((activasRes.data as ObraConAsignados[]) ?? []);
        setArchivadas((archRes.data as ObraConAsignados[]) ?? []);
      } else {
        const [obrasRes, obraHoyRes] = await Promise.all([
          fetch(`/api/obras/activas?tenantId=${tenantId}`).then((r) => r.json()).catch(() => []),
          getAsignacionHoyByUser(user!.id).catch(() => null),
        ]);
        setObras(Array.isArray(obrasRes) ? obrasRes : []);
        setObraHoy(obraHoyRes);
      }
    } catch (e) {
      console.error("[obras] Error inesperado:", e);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <LoadingSkeleton />;

  // Separar por estado
  const activas  = obras.filter((o) => o.estado === "activa" || o.estado === "pausada");
  const proximas = obras.filter((o) => o.estado === "proxima");

  const totalActivas = activas.length;
  const subtitle = totalActivas === 0
    ? "Sin obras activas"
    : `${totalActivas} obra${totalActivas !== 1 ? "s" : ""} activa${totalActivas !== 1 ? "s" : ""}`;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Obras"
        subtitle={subtitle}
        action={isAdmin ? (
          <button onClick={() => setShowCrearModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva obra
          </button>
        ) : undefined}
      />

      {/* Banner obra de hoy — solo empleados */}
      {!isAdmin && (
        <div className="mb-6">
          {obraHoy ? (
            <ObraEmpleadoCard obra={obraHoy} />
          ) : (
            <div className="card p-4 flex items-center gap-3 border-l-4 border-warning">
              <Building2 className="w-5 h-5 text-warning flex-shrink-0" />
              <div>
                <p className="font-medium text-content-primary text-sm">Sin asignación hoy</p>
                <p className="text-xs text-content-secondary">Día libre o ausencia registrada</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Obras activas / pausadas ───────────────────────────── */}
      {activas.length === 0 && proximas.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center gap-4">
          <div className="icon-container w-14 h-14">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <p className="font-semibold text-content-primary mb-1">Sin obras activas</p>
            <p className="text-sm text-content-secondary">
              {isAdmin ? "Crea la primera obra para empezar a gestionar tu equipo." : "No hay obras activas en este momento."}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCrearModal(true)} className="btn-primary mt-2">
              <Plus className="w-4 h-4" /> Crear primera obra
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activas.map((obra) => (
            <ObraCard key={obra.id} obra={obra} onUpdate={cargar} />
          ))}
        </div>
      )}

      {/* ── Próximas obras — collapsible morado ───────────────── */}
      {proximas.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setProximasOpen((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 12, cursor: "pointer", border: "none",
              background: "#EDE9FE", marginBottom: proximasOpen ? 10 : 0,
              transition: "border-radius 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock style={{ width: 16, height: 16, color: "#7c3aed" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>
                Próximas obras
              </span>
              <span style={{
                background: "#7c3aed", color: "#fff",
                borderRadius: 20, fontSize: 11, fontWeight: 700,
                padding: "1px 8px", lineHeight: "18px",
              }}>
                {proximas.length}
              </span>
            </div>
            {proximasOpen
              ? <ChevronUp style={{ width: 16, height: 16, color: "#7c3aed" }} />
              : <ChevronDown style={{ width: 16, height: 16, color: "#7c3aed" }} />
            }
          </button>

          {proximasOpen && (
            <div className="space-y-3">
              {proximas.map((obra) => (
                <ObraCard key={obra.id} obra={obra} onUpdate={cargar} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Obras archivadas — collapsible gris (solo admin) ──── */}
      {isAdmin && (
        <div className="mt-5">
          <button
            onClick={() => setArchivadasOpen((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 12, cursor: "pointer", border: "none",
              background: "#F3F4F6", marginBottom: archivadasOpen ? 10 : 0,
              transition: "border-radius 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Archive style={{ width: 16, height: 16, color: "#6b7280" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#4A5568" }}>
                Obras archivadas
              </span>
              {archivadas.length > 0 && (
                <span style={{
                  background: "#9ca3af", color: "#fff",
                  borderRadius: 20, fontSize: 11, fontWeight: 700,
                  padding: "1px 8px", lineHeight: "18px",
                }}>
                  {archivadas.length}
                </span>
              )}
            </div>
            {archivadasOpen
              ? <ChevronUp style={{ width: 16, height: 16, color: "#6b7280" }} />
              : <ChevronDown style={{ width: 16, height: 16, color: "#6b7280" }} />
            }
          </button>

          {archivadasOpen && (
            archivadas.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-sm text-content-secondary">No hay obras archivadas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivadas.map((obra) => (
                  <ObraCard key={obra.id} obra={obra} onUpdate={cargar} />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Espacio inferior para la bottom nav */}
      <div className="h-6" />

      {showCrearModal && (
        <CrearObraModal
          tenantId={tenantId!}
          userId={user!.id}
          onClose={() => setShowCrearModal(false)}
          onCreated={() => { setShowCrearModal(false); cargar(); }}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
    </div>
  );
}
