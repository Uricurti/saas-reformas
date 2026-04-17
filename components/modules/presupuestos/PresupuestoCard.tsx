"use client";

import type { Presupuesto } from "@/types";
import { FileText, Pencil, Copy, Building2, Trash2, Send, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { updatePresupuesto } from "@/lib/insforge/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};
const ESTADO_COLOR: Record<string, string> = {
  borrador:  "badge-gray",
  enviado:   "badge-blue",
  aceptado:  "badge-green",
  rechazado: "badge-red",
};
const TIPO_LABEL: Record<string, string> = {
  bano: "Baño",
  cocina: "Cocina",
  otros: "Otros",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: es }); } catch { return d; }
}
function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}


export function PresupuestoCard({
  presupuesto,
  onVerPDF,
  onEditar,
  onDuplicar,
  onCrearObra,
  onEliminar,
  onUpdate,
}: {
  presupuesto: Presupuesto;
  onVerPDF: (id: string) => void;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onCrearObra: (id: string) => void;
  onEliminar: (id: string) => void;
  onUpdate: () => void;
}) {
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [eliminando, setEliminando]           = useState(false);

  const vencida = presupuesto.estado === "enviado" && new Date(presupuesto.fecha_validez) < new Date();

  async function handleEliminar() {
    if (!confirm(`¿Eliminar el presupuesto ${presupuesto.numero}? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    await onEliminar(presupuesto.id);
    setEliminando(false);
  }

  async function cambiarEstado(estado: string) {
    setCambiandoEstado(true);
    await updatePresupuesto(presupuesto.id, { estado: estado as any });
    setCambiandoEstado(false);
    onUpdate();
  }

  return (
    <div className="card p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        {/* Icono tipo */}
        <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0 text-lg">
          {presupuesto.tipo === "bano" ? "🛁" : presupuesto.tipo === "cocina" ? "🍳" : "🏗️"}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-sm font-bold text-content-primary">{presupuesto.numero}</span>
            {presupuesto.version > 1 && (
              <span className="text-xs font-semibold text-content-muted bg-gray-100 px-1.5 py-0.5 rounded">v{presupuesto.version}</span>
            )}
            <span className={`badge ${ESTADO_COLOR[presupuesto.estado] ?? "badge-gray"}`}>
              {ESTADO_LABEL[presupuesto.estado] ?? presupuesto.estado}
            </span>
            <span className="badge badge-gray">{TIPO_LABEL[presupuesto.tipo] ?? presupuesto.tipo}</span>
          </div>

          {/* Cliente */}
          <p className="text-sm font-semibold text-content-primary truncate">
            {presupuesto.cliente_nombre}{presupuesto.cliente_apellidos ? " " + presupuesto.cliente_apellidos : ""}
          </p>
          {(presupuesto.cliente_ciudad || presupuesto.cliente_direccion) && (
            <p className="text-xs text-content-muted truncate">
              {[presupuesto.cliente_direccion, presupuesto.cliente_ciudad].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Fechas */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-content-muted">
            <span>Emitido: {fmtDate(presupuesto.fecha_emision)}</span>
            <span className={vencida ? "text-danger font-semibold" : ""}>
              Válido hasta: {fmtDate(presupuesto.fecha_validez)}
              {vencida && " ⚠️"}
            </span>
          </div>
        </div>

        {/* Importe */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black text-content-primary">{fmtE(presupuesto.importe_total)}</p>
          <p className="text-xs text-content-muted">IVA {presupuesto.porcentaje_iva}% inc.</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
        <button onClick={() => onVerPDF(presupuesto.id)} className="btn-ghost text-xs py-1.5">
          <FileText className="w-3.5 h-3.5" /> Ver PDF
        </button>

        {presupuesto.estado !== "aceptado" && presupuesto.estado !== "rechazado" && (
          <button onClick={() => onEditar(presupuesto.id)} className="btn-ghost text-xs py-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        )}

        <button onClick={() => onDuplicar(presupuesto.id)} className="btn-ghost text-xs py-1.5">
          <Copy className="w-3.5 h-3.5" /> Duplicar
        </button>

        <button
          onClick={handleEliminar}
          disabled={eliminando}
          className="btn-ghost text-xs py-1.5 text-danger hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {eliminando ? "Eliminando..." : "Eliminar"}
        </button>

        {/* Borrador → Enviado */}
        {presupuesto.estado === "borrador" && (
          <button
            onClick={() => cambiarEstado("enviado")}
            disabled={cambiandoEstado}
            className="btn-secondary text-xs py-1.5 ml-auto"
          >
            <Send className="w-3.5 h-3.5" />
            {cambiandoEstado ? "..." : "Enviado"}
          </button>
        )}

        {/* Enviado → Aceptado / Rechazado */}
        {presupuesto.estado === "enviado" && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => cambiarEstado("rechazado")}
              disabled={cambiandoEstado}
              className="btn-ghost text-xs py-1.5 text-danger hover:bg-red-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              {cambiandoEstado ? "..." : "Rechazado"}
            </button>
            <button
              onClick={() => cambiarEstado("aceptado")}
              disabled={cambiandoEstado}
              className="text-xs py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {cambiandoEstado ? "..." : "Aceptado"}
            </button>
          </div>
        )}

        {/* Aceptado sin obra → Crear obra */}
        {presupuesto.estado === "aceptado" && !presupuesto.obra_id && (
          <button
            onClick={() => onCrearObra(presupuesto.id)}
            className="btn-primary text-xs py-1.5 ml-auto"
          >
            <Building2 className="w-3.5 h-3.5" /> Crear obra
          </button>
        )}

        {/* Rechazado → volver a borrador */}
        {presupuesto.estado === "rechazado" && (
          <button
            onClick={() => cambiarEstado("borrador")}
            disabled={cambiandoEstado}
            className="btn-ghost text-xs py-1.5 ml-auto"
          >
            {cambiandoEstado ? "..." : "Volver a borrador"}
          </button>
        )}
      </div>
    </div>
  );
}
