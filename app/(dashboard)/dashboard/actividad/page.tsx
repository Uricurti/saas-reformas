"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import { ActividadRow, tiempoRelativo, type ActividadItem } from "../page";

function isSameDay(a: string, b: string) {
  return a.split("T")[0] === b.split("T")[0];
}

function groupByDay(items: ActividadItem[]): { label: string; items: ActividadItem[] }[] {
  const hoy   = new Date().toISOString().split("T")[0];
  const ayer  = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const groups: Record<string, ActividadItem[]> = {};

  for (const item of items) {
    const dia = item.created_at.split("T")[0];
    if (!groups[dia]) groups[dia] = [];
    groups[dia].push(item);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dia, items]) => ({
      label: dia === hoy ? "Hoy" : dia === ayer ? "Ayer" : new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
      items,
    }));
}

function LoadingSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-7 h-7 rounded-full animate-pulse flex-shrink-0" style={{ background: "#F3F4F6" }} />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-4 rounded animate-pulse" style={{ background: "#F3F4F6", width: "70%" }} />
            <div className="h-3 rounded animate-pulse" style={{ background: "#F3F4F6", width: "30%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActividadPage() {
  const router   = useRouter();
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  const [items,   setItems]   = useState<ActividadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (isAdmin === false) router.replace("/obras"); }, [isAdmin, router]);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/dashboard/data?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.actividad ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { if (tenantId) cargar(); }, [tenantId, cargar]);
  useRefreshOnFocus(() => { if (tenantId) cargar(); });

  if (loading) return <LoadingSkeleton />;

  const groups = groupByDay(items);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">

      {/* Cabecera */}
      <div className="flex items-center gap-3 mb-7">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: "#F3F4F6", color: "#6B7280" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1c3879" }}>
            Actividad reciente
          </h1>
          <p className="text-xs" style={{ color: "#94A3B8" }}>Últimas 48 horas</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#EEF2F8" }}>
            <Activity className="w-7 h-7" style={{ color: "#607eaa" }} />
          </div>
          <p className="font-semibold" style={{ color: "#1c3879" }}>Sin actividad reciente</p>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Aquí aparecerán los fichajes, peticiones de material y fotos de las últimas 48h.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Separador de día */}
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ background: "#EEF2F8", color: "#607eaa" }}
                >
                  {group.label}
                </span>
                <div className="flex-1 h-px" style={{ background: "#F3F4F6" }} />
              </div>

              {/* Items del día */}
              <div className="card px-4 py-1">
                {group.items.map((item, i) => (
                  <ActividadRow
                    key={item.id}
                    item={item}
                    last={i === group.items.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
