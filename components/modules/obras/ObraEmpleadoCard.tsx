import type { Obra } from "@/types";
import { Building2, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { DireccionLink } from "@/components/ui/DireccionLink";

interface Props { obra: Obra }

export function ObraEmpleadoCard({ obra }: Props) {
  return (
    <Link href={`/obras/${obra.id}`} className="block">
      <div className="card p-5 border-2 border-primary/20 hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide mb-3">
          <Building2 className="w-3.5 h-3.5" />
          Tu obra de hoy
        </div>
        <h2 className="text-xl font-bold text-content-primary mb-2">{obra.nombre}</h2>
        <div className="flex items-start gap-1.5 text-sm text-content-secondary mb-1">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <DireccionLink
            direccion={obra.direccion}
            showExternalIcon
            className="text-sm text-content-secondary"
          />
        </div>
        {obra.cliente_telefono && (
          <div className="flex items-center gap-1.5 text-sm text-content-secondary">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <a href={`tel:${obra.cliente_telefono}`} className="hover:text-primary">
              {obra.cliente_telefono}
            </a>
          </div>
        )}
      </div>
    </Link>
  );
}
