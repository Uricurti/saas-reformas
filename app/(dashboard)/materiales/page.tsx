"use client";

import { useEffect, useState } from "react";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getMaterialesActivos, marcarMaterialesComprados } from "@/lib/insforge/database";
import type { MaterialConDetalles } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModoCompraView } from "@/components/modules/materiales/ModoCompraView";
import { ListaMateriales } from "@/components/modules/materiales/ListaMateriales";
import { PedirMaterialModal } from "@/components/modules/materiales/PedirMaterialModal";
import { GestorPasillos } from "@/components/modules/materiales/GestorPasillos";
import { ShoppingCart, Plus, ShoppingBag, MapPin } from "lucide-react";

export default function MaterialesPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const tenantId = useTenantId();

  const [materiales, setMateriales] = useState<MaterialConDetalles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modoCompra, setModoCompra] = useState(false);
  const [showPedirModal, setShowPedirModal] = useState(false);
  const [showGestorPasillos, setShowGestorPasillos] = useState(false);
  const [obraIdPedido, setObraIdPedido] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) cargar();
  }, [tenantId]);

  async function cargar() {
    setIsLoading(true);
    const { data } = await getMaterialesActivos(tenantId!);
    setMateriales((data as MaterialConDetalles[]) ?? []);
    setIsLoading(false);
  }

  async function handleCompraFinalizada(idsComprados: string[]) {
    await marcarMaterialesComprados(idsComprados, user?.id);
    setModoCompra(false);
    cargar();
  }

  if (modoCompra) {
    return (
      <ModoCompraView
        tenantId={tenantId!}
        materiales={materiales.filter((m) => m.estado === "pendiente")}
        onFinalizar={handleCompraFinalizada}
        onCancelar={() => setModoCompra(false)}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Materiales"
        subtitle={(() => {
          const n = materiales.filter((m) => m.estado === "pendiente").length;
          return n === 0 ? "Todo comprado" : `${n} ítem${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""}`;
        })()}
        action={
          <div className="flex flex-wrap gap-2 justify-end">
            {isAdmin && (
              <button onClick={() => setShowGestorPasillos(true)} className="btn-ghost text-sm">
                <MapPin className="w-4 h-4" /> Pasillos
              </button>
            )}
            <button onClick={() => setShowPedirModal(true)} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> Pedir
            </button>
            {materiales.some((m) => m.estado === "pendiente") && (
              <button onClick={() => setModoCompra(true)} className="btn-primary text-sm">
                <ShoppingBag className="w-4 h-4" /> Compra
              </button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : materiales.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center gap-4">
          <div className="icon-container w-14 h-14">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <p className="font-semibold text-content-primary mb-1">Sin materiales pendientes</p>
            <p className="text-sm text-content-secondary">Todo está comprado. ¡Bien! 🎉</p>
          </div>
          <button onClick={() => setShowPedirModal(true)} className="btn-primary mt-2">
            <Plus className="w-4 h-4" /> Pedir material
          </button>
        </div>
      ) : (
        <ListaMateriales isAdmin={isAdmin} materiales={materiales} onUpdate={cargar} />
      )}

      {showPedirModal && (
        <PedirMaterialModal
          tenantId={tenantId!}
          userId={user!.id}
          obraIdInicial={obraIdPedido}
          onClose={() => { setShowPedirModal(false); setObraIdPedido(null); }}
          onCreated={() => { setShowPedirModal(false); setObraIdPedido(null); cargar(); }}
        />
      )}

      {showGestorPasillos && isAdmin && (
        <GestorPasillos
          tenantId={tenantId!}
          onClose={() => setShowGestorPasillos(false)}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
    </div>
  );
}
