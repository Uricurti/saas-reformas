"use client";

import Link from "next/link";
import type { ObraConAsignados } from "@/types";
import { Building2, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";

interface Props {
  obra: ObraConAsignados;
  onUpdate: () => void;
}

export function ObraCard({ obra, onUpdate }: Props) {
  const numAsignados = obra.asignaciones?.length ?? 0;

  const estadoConfig: Record<string, { cls: string; label: string }> = {
    activa:    { cls: "badge-success", label: "Activa" },
    pausada:   { cls: "badge-warning", label: "Pausada" },
    proxima:   { cls: "badge-blue",    label: "Próxima" },
    archivada: { cls: "badge-gray",    label: "Archivada" },
  };
  const { cls: estadoColor, label: estadoLabel } = estadoConfig[obra.estado] ?? { cls: "badge-gray", label: obra.estado };

  return (
    <Link
      href={`/obras/${obra.id}`}
      className="card p-4 md:p-5 flex items-start gap-4 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
    >
      {/* Icono */}
      <div className="icon-container flex-shrink-0">
        <Building2 className="w-5 h-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-content-primary">{obra.nombre}</h3>
          <span className={cn("badge", estadoColor)}>{estadoLabel}</span>
        </div>

        <div className="flex items-center gap-1 text-sm text-content-secondary mb-3">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-content-muted" />
          {/* span en lugar de <a> para evitar <a> anidado dentro del <Link> padre */}
          <span
            className="truncate text-content-secondary text-sm hover:text-primary cursor-pointer transition-colors"
            title="Abrir en Google Maps"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (obra.direccion) {
                window.open(`https://maps.google.com/?q=${encodeURIComponent(obra.direccion)}`, "_blank");
              }
            }}
          >
            {obra.direccion}
          </span>
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
    </Link>
  );
}
