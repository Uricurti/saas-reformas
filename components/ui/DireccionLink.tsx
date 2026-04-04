"use client";

/**
 * Muestra una dirección como enlace clicable que abre Google Maps.
 * Si la dirección está vacía, no renderiza nada.
 */

import { MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  direccion: string;
  /** Mostrar icono de pin delante */
  showIcon?: boolean;
  /** Mostrar icono de enlace externo al final */
  showExternalIcon?: boolean;
  className?: string;
  iconClassName?: string;
}

export function DireccionLink({
  direccion,
  showIcon = false,
  showExternalIcon = false,
  className,
  iconClassName,
}: Props) {
  if (!direccion) return null;

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(direccion)}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 hover:text-primary transition-colors group",
        className
      )}
      title="Abrir en Google Maps"
      onClick={(e) => e.stopPropagation()} // evita activar cards/links padre
    >
      {showIcon && (
        <MapPin className={cn("w-3.5 h-3.5 flex-shrink-0", iconClassName)} />
      )}
      <span className="group-hover:underline underline-offset-2">{direccion}</span>
      {showExternalIcon && (
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
      )}
    </a>
  );
}
