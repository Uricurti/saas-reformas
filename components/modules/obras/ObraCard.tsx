"use client";

import { useState } from "react";
import Link from "next/link";
import type { ObraConAsignados } from "@/types";
import { archivarObra } from "@/lib/insforge/database";
import { Building2, MapPin, Users, ChevronRight, Archive, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";
import { DireccionLink } from "@/components/ui/DireccionLink";

interface Props {
  obra: ObraConAsignados;
  onUpdate: () => void;
}

export function ObraCard({ obra, onUpdate }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [archivando, setArchivando] = useState(false);

  const numAsignados = obra.asignaciones?.length ?? 0;

  async function handleArchivar() {
    if (!confirm(`¿Archivar la obra "${obra.nombre}"? No aparecerá en la lista activa, pero podrás consultarla en el historial.`)) return;
    setArchivando(true);
    await archivarObra(obra.id);
    onUpdate();
  }

  const estadoColor = {
    activa: "badge-success",
    pausada: "badge-warning",
    archivada: "badge-gray",
  }[obra.estado];

  return (
    <div className="card p-4 md:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Icono */}
        <div className="icon-container flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-content-primary">{obra.nombre}</h3>
            <span className={cn("badge", estadoColor)}>{obra.estado}</span>
          </div>

          <div className="flex items-center gap-1 text-sm text-content-secondary mb-3">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-content-muted" />
            <DireccionLink
              direccion={obra.direccion}
              showExternalIcon
              className="truncate text-content-secondary text-sm"
            />
          </div>

          {/* Avatares de asignados */}
          {numAsignados > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {obra.asignaciones.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    title={a.user?.nombre}
                    className="w-7 h-7 rounded-full bg-primary-light border-2 border-white flex items-center justify-center"
                  >
                    <span className="text-[10px] font-semibold text-primary">
                      {a.user ? initials(a.user.nombre) : "?"}
                    </span>
                  </div>
                ))}
                {numAsignados > 4 && (
                  <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                    <span className="text-[10px] font-medium text-content-secondary">+{numAsignados - 4}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-content-muted">
                <Users className="w-3 h-3 inline mr-0.5" />
                {numAsignados} asignado{numAsignados !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="btn-ghost p-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-9 w-44 bg-white rounded-xl shadow-dropdown border border-border py-1 z-10 animate-scale-in">
                <Link
                  href={`/obras/${obra.id}`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-content-primary hover:bg-gray-50"
                  onClick={() => setShowMenu(false)}
                >
                  <ChevronRight className="w-4 h-4" /> Ver detalle
                </Link>
                <button
                  onClick={handleArchivar}
                  disabled={archivando}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-warning-foreground hover:bg-warning-light"
                >
                  <Archive className="w-4 h-4" />
                  {archivando ? "Archivando..." : "Archivar obra"}
                </button>
              </div>
            )}
          </div>

          <Link href={`/obras/${obra.id}`} className="btn-ghost p-2">
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
