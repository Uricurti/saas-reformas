"use client";

import { Plus, X } from "lucide-react";

export type FilaPago = { concepto: string; porcentaje: number };

const PRESETS = [
  {
    label: "1 pago · 100%",
    pagos: [{ concepto: "Pago único", porcentaje: 100 }],
  },
  {
    label: "2 pagos · 50/50",
    pagos: [
      { concepto: "A la aceptación", porcentaje: 50 },
      { concepto: "A la finalización", porcentaje: 50 },
    ],
  },
  {
    label: "3 pagos · 40/50/10",
    pagos: [
      { concepto: "A la aceptación del presupuesto", porcentaje: 40 },
      { concepto: "A mitad de obra", porcentaje: 50 },
      { concepto: "A la finalización de los trabajos", porcentaje: 10 },
    ],
  },
];

export function FormaPagoEditor({
  value,
  onChange,
}: {
  value: FilaPago[];
  onChange: (v: FilaPago[]) => void;
}) {
  const total = value.reduce((s, f) => s + (f.porcentaje || 0), 0);
  const ok = Math.abs(total - 100) < 0.01;

  function activePreset() {
    return PRESETS.findIndex(
      (p) =>
        p.pagos.length === value.length &&
        p.pagos.every((pp, i) => pp.porcentaje === value[i]?.porcentaje)
    );
  }

  return (
    <div className="space-y-3">
      {/* Presets rápidos */}
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset, idx) => {
          const isActive = activePreset() === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(preset.pagos.map((p) => ({ ...p })))}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border-2 transition-all text-center ${
                isActive
                  ? "border-primary bg-primary-light text-primary"
                  : "border-gray-200 text-content-secondary hover:border-gray-300 bg-white"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Filas editables */}
      <div className="space-y-2">
        {value.map((fp, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input flex-1 text-sm"
              value={fp.concepto}
              placeholder={`Hito ${i + 1}`}
              onChange={(e) =>
                onChange(value.map((f, j) => (j === i ? { ...f, concepto: e.target.value } : f)))
              }
            />
            <div className="flex items-center gap-1">
              <input
                className="input w-16 text-sm text-center"
                type="number"
                min={0}
                max={100}
                value={fp.porcentaje}
                onChange={(e) =>
                  onChange(value.map((f, j) => (j === i ? { ...f, porcentaje: parseInt(e.target.value) || 0 } : f)))
                }
              />
              <span className="text-sm text-content-muted">%</span>
            </div>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="p-1 rounded hover:bg-red-50 hover:text-red-500 text-content-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Añadir + total */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...value, { concepto: `Hito ${value.length + 1}`, porcentaje: 0 }])}
          className="btn-ghost text-xs py-1"
        >
          <Plus className="w-3.5 h-3.5" /> Añadir hito
        </button>
        <p className="text-xs text-content-muted">
          Total:{" "}
          <span className={`font-semibold ${ok ? "text-emerald-600" : "text-danger"}`}>
            {total}%{!ok && " (debe ser 100%)"}
          </span>
        </p>
      </div>
    </div>
  );
}
