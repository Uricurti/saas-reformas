"use client";

import { useEffect, useState } from "react";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getObrasActivas } from "@/lib/insforge/database";
import { getAsignacionHoyByUser } from "@/lib/insforge/database";
import type { ObraConAsignados, Obra } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ObraCard } from "@/components/modules/obras/ObraCard";
import { ObraEmpleadoCard } from "@/components/modules/obras/ObraEmpleadoCard";
import { CrearObraModal } from "@/components/modules/obras/CrearObraModal";
import { Building2, Plus, Archive } from "lucide-react";
import Link from "next/link";

export default function ObrasPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const tenantId = useTenantId();

  const [obras, setObras] = useState<ObraConAsignados[]>([]);
  const [obraHoy, setObraHoy] = useState<Obra | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCrearModal, setShowCrearModal] = useState(false);

  useEffect(() => {
    if (tenantId) cargar();
  }, [tenantId]);

  async function cargar() {
    setIsLoading(true);
    const { data, error } = await getObrasActivas(tenantId!);
    if (error) {
      console.error("[obras] Error cargando obras:", error);
    }
    setObras((data as ObraConAsignados[]) ?? []);

    if (!isAdmin && user) {
      const obra = await getAsignacionHoyByUser(user.id);
      setObraHoy(obra);
    }
    setIsLoading(false);
  }

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title={isAdmin ? "Obras" : "Mis obras"}
        subtitle={isAdmin
          ? `${obras.length} obra${obras.length !== 1 ? "s" : ""} activa${obras.length !== 1 ? "s" : ""}`
          : "Tu asignación de hoy y próximos días"}
        action={isAdmin ? (
          <button onClick={() => setShowCrearModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva obra
          </button>
        ) : undefined}
      />

      {/* Vista empleado: obra de hoy destacada */}
      {!isAdmin && (
        <div className="mb-6">
          {obraHoy ? (
            <ObraEmpleadoCard obra={obraHoy} />
          ) : (
            <div className="card p-6 flex flex-col items-center text-center gap-3">
              <div className="icon-container-gray w-12 h-12">
                <Building2 className="w-6 h-6" />
              </div>
              <p className="font-medium text-content-primary">Sin asignación hoy</p>
              <p className="text-sm text-content-secondary">No tienes ninguna obra asignada para hoy.</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de obras (admin) */}
      {isAdmin && (
        <>
          {obras.length === 0 ? (
            <div className="card p-10 flex flex-col items-center text-center gap-4">
              <div className="icon-container w-14 h-14">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <p className="font-semibold text-content-primary mb-1">Sin obras activas</p>
                <p className="text-sm text-content-secondary">Crea la primera obra para empezar a gestionar tu equipo.</p>
              </div>
              <button onClick={() => setShowCrearModal(true)} className="btn-primary mt-2">
                <Plus className="w-4 h-4" /> Crear primera obra
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {obras.map((obra) => (
                <ObraCard key={obra.id} obra={obra} onUpdate={cargar} />
              ))}
            </div>
          )}

          {/* Link al archivo */}
          <div className="mt-6 text-center">
            <Link href="/obras/archivo" className="btn-ghost text-content-secondary">
              <Archive className="w-4 h-4" /> Ver obras archivadas
            </Link>
          </div>
        </>
      )}

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
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-32 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 h-24" />
        ))}
      </div>
    </div>
  );
}
