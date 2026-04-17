"use client";

import { useState } from "react";
import { X, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { convertirPresupuestoAObra } from "@/lib/insforge/database";
import type { Presupuesto } from "@/types";
import { useRouter } from "next/navigation";

const TIPO_LABEL: Record<string, string> = {
  bano: "Reforma de baño",
  cocina: "Reforma de cocina",
  otros: "Reforma integral",
};

function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function PresupuestoAObraModal({
  presupuesto,
  tenantId,
  userId,
  onClose,
  onCreada,
}: {
  presupuesto: Presupuesto;
  tenantId: string;
  userId: string;
  onClose: () => void;
  onCreada: () => void;
}) {
  const router = useRouter();
  const nombreSugerido = [
    TIPO_LABEL[presupuesto.tipo] ?? "Reforma",
    presupuesto.cliente_apellidos
      ? "— " + presupuesto.cliente_apellidos
      : presupuesto.cliente_nombre
      ? "— " + presupuesto.cliente_nombre
      : "",
  ].join(" ").trim();

  const [nombreObra, setNombreObra]   = useState(nombreSugerido);
  const [creando, setCreando]         = useState(false);
  const [obraId, setObraId]           = useState<string | null>(null);

  async function handleCrear() {
    if (!nombreObra.trim()) return alert("El nombre de la obra es obligatorio.");
    setCreando(true);
    const result = await convertirPresupuestoAObra(presupuesto.id, tenantId, userId, nombreObra.trim());
    setCreando(false);
    if (result) {
      setObraId(result.obra_id);
      onCreada();
    } else {
      alert("Error al crear la obra. Inténtalo de nuevo.");
    }
  }

  if (obraId) {
    return (
      <div className="modal-overlay" style={{ zIndex: 9100 }}>
        <div className="modal-panel" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "2rem" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-content-primary">¡Obra creada!</h2>
              <p className="text-sm text-content-secondary mt-1">
                La obra <strong>{nombreObra}</strong> se ha creado con la factura y los hitos de pago.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
              <button
                onClick={() => { onClose(); router.push(`/obras/${obraId}`); }}
                className="btn-primary flex-1"
              >
                <Building2 className="w-4 h-4" /> Ver obra
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9100 }}>
      <div className="modal-panel" style={{ maxWidth: 480, width: "100%" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-content-primary">Crear obra desde presupuesto</h2>
            <p className="text-sm text-content-secondary">Se generará la obra con factura y hitos de pago</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Resumen presupuesto */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-content-muted uppercase tracking-wider">Presupuesto</p>
            <p className="text-sm font-semibold text-content-primary">
              {presupuesto.numero} · {TIPO_LABEL[presupuesto.tipo] ?? presupuesto.tipo}
            </p>
            <p className="text-sm text-content-secondary">
              {presupuesto.cliente_nombre}{presupuesto.cliente_apellidos ? " " + presupuesto.cliente_apellidos : ""}
            </p>
            <p className="text-lg font-black text-content-primary">{fmtE(presupuesto.importe_total)}</p>
          </div>

          {/* Nombre obra */}
          <div>
            <label className="label">Nombre de la obra *</label>
            <input
              className="input"
              value={nombreObra}
              onChange={(e) => setNombreObra(e.target.value)}
              placeholder="Ej: Reforma baño Calle Mayor"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">¿Qué se creará automáticamente?</p>
            <p>✅ Obra activa con los datos del cliente del presupuesto</p>
            <p>✅ Factura con el importe total</p>
            <p>✅ {presupuesto.forma_pago?.length ?? 3} hitos de pago según la forma de pago del presupuesto</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleCrear} disabled={creando || !nombreObra.trim()} className="btn-primary flex-1">
            {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Building2 className="w-4 h-4" /> Crear obra</>}
          </button>
        </div>
      </div>
    </div>
  );
}
