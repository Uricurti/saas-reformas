"use client";

import { useState } from "react";
import { X, Download, FileSpreadsheet, Loader2, Info } from "lucide-react";
import {
  getJornadasByMes,
  getUsuariosByTenant,
  getObrasActivas,
  getTarifaEmpleado,
} from "@/lib/insforge/database";
import type { User, Jornada, Obra } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ESTADO_LABELS: Record<string, string> = {
  trabajando: "Trabajando",
  libre:      "Libre",
  baja:       "Baja médica",
  permiso:    "Permiso",
  vacaciones: "Vacaciones",
  otro:       "Otro",
};

// Colores de fondo para cada estado (ARGB)
const ESTADO_COLORS: Record<string, string> = {
  trabajando: "FFD1FAE5", // verde suave
  libre:      "FFFEF3C7", // amarillo suave
  baja:       "FFFEE2E2", // rojo suave
  permiso:    "FFDBEAFE", // azul suave
  vacaciones: "FFE0F2FE", // celeste suave
  otro:       "FFF3F4F6", // gris suave
};

interface Props {
  tenantId: string;
  onClose:  () => void;
}

function primerDiaMes() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-01`;
}
function ultimoDiaMes() {
  const h = new Date();
  const u = new Date(h.getFullYear(), h.getMonth() + 1, 0);
  return `${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, "0")}-${String(u.getDate()).padStart(2, "0")}`;
}

export function ExportarExcelModal({ tenantId, onClose }: Props) {
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin,    setFechaFin]    = useState(ultimoDiaMes);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function exportar() {
    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) {
      setError("La fecha de inicio debe ser anterior a la de fin.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // ── 1. Cargar datos ──────────────────────────────────────────────
      const [usersRes, jornadasRes, obrasRes] = await Promise.all([
        getUsuariosByTenant(tenantId),
        getJornadasByMes(tenantId, fechaInicio, fechaFin),
        getObrasActivas(tenantId),
      ]);

      const empleados = ((usersRes.data as User[]) ?? []).filter(u => u.rol === "empleado");
      const jornadas  = (jornadasRes.data as Jornada[]) ?? [];
      const obras     = (obrasRes.data as Obra[]) ?? [];

      // Tarifas de cada empleado
      const tarifas: Record<string, number> = {};
      await Promise.all(empleados.map(async u => {
        tarifas[u.id] = await getTarifaEmpleado(u.id);
      }));

      // ── 2. Construir Excel con ExcelJS (import dinámico → solo browser) ─
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator  = "ReforLife";
      wb.created  = new Date();
      wb.modified = new Date();

      const AZUL_OSCURO  = "FF1C3879";
      const AZUL_MEDIO   = "FF607EAA";
      const AZUL_CLARO   = "FFEEF2F8";
      const BLANCO       = "FFFFFFFF";
      const GRIS_TEXTO   = "FF4A5568";
      const FILA_PAR     = "FFF7F8FC";

      const fmtEuro = '#,##0.00 "€"';
      const borderHair = { style: "hair" as const, color: { argb: "FFE0E0E8" } };

      const fechaIFmt = format(new Date(fechaInicio + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es });
      const fechaFFmt = format(new Date(fechaFin      + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es });

      // ══════════════════════════════════════════════════════════════
      // HOJA 1 — RESUMEN POR EMPLEADO
      // ══════════════════════════════════════════════════════════════
      const ws1 = wb.addWorksheet("Resumen");
      ws1.columns = [
        { width: 30 }, // Empleado
        { width: 18 }, // Días trabajados
        { width: 13 }, // Días baja
        { width: 15 }, // Días permiso/vac
        { width: 16 }, // Tarifa/día
        { width: 18 }, // Total bruto
      ];

      // Fila 1 — Título
      ws1.mergeCells("A1:F1");
      const t1 = ws1.getCell("A1");
      t1.value     = "INFORME DE FICHAJES Y JORNALES";
      t1.font      = { name: "Calibri", bold: true, size: 16, color: { argb: BLANCO } };
      t1.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_OSCURO } };
      t1.alignment = { horizontal: "center", vertical: "middle" };
      ws1.getRow(1).height = 38;

      // Fila 2 — Período
      ws1.mergeCells("A2:F2");
      const t2 = ws1.getCell("A2");
      t2.value     = `Período: ${fechaIFmt}  —  ${fechaFFmt}`;
      t2.font      = { name: "Calibri", italic: true, size: 11, color: { argb: GRIS_TEXTO } };
      t2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
      t2.alignment = { horizontal: "center", vertical: "middle" };
      ws1.getRow(2).height = 22;

      // Fila 3 — vacía
      ws1.addRow([]).height = 6;

      // Fila 4 — Cabeceras
      const cabeceras1 = ["Empleado", "Días Trabajados", "Días Baja", "Días Permiso / Vac.", "Tarifa / día (€)", "Total Bruto (€)"];
      const hRow1 = ws1.addRow(cabeceras1);
      hRow1.eachCell(cell => {
        cell.font      = { name: "Calibri", bold: true, size: 11, color: { argb: BLANCO } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_MEDIO } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border    = { bottom: { style: "medium", color: { argb: AZUL_OSCURO } } };
      });
      hRow1.height = 30;

      // Filas de datos
      let totalGeneral = 0;
      empleados.forEach((emp, idx) => {
        const jEmp          = jornadas.filter(j => j.user_id === emp.id);
        const diasTrabajados = jEmp.filter(j => j.estado === "trabajando" && j.ha_fichado).length;
        const diasBaja       = jEmp.filter(j => j.estado === "baja").length;
        const diasPermiso    = jEmp.filter(j => ["permiso", "vacaciones", "otro"].includes(j.estado)).length;
        const tarifa         = tarifas[emp.id] ?? 0;
        const total          = diasTrabajados * tarifa;
        totalGeneral        += total;

        const row = ws1.addRow([emp.nombre, diasTrabajados, diasBaja, diasPermiso, tarifa, total]);
        const bg  = idx % 2 === 0 ? BLANCO : FILA_PAR;

        row.eachCell((cell, col) => {
          cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font   = { name: "Calibri", size: 10 };
          cell.border = { bottom: borderHair };
          if (col >= 2) cell.alignment = { horizontal: "center" };
          if (col === 5) cell.numFmt = fmtEuro;
          if (col === 6) {
            cell.numFmt = fmtEuro;
            cell.font   = { name: "Calibri", size: 10, bold: true, color: { argb: AZUL_OSCURO } };
          }
        });
        row.height = 22;
      });

      // Fila de totales
      const totRow = ws1.addRow(["TOTAL DEL PERÍODO", "", "", "", "", totalGeneral]);
      totRow.eachCell((cell, col) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_OSCURO } };
        cell.font      = { name: "Calibri", bold: true, size: 12, color: { argb: BLANCO } };
        cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
        if (col === 6) cell.numFmt = fmtEuro;
      });
      totRow.height = 28;

      ws1.views = [{ state: "frozen", ySplit: 4 }];

      // ══════════════════════════════════════════════════════════════
      // HOJA 2 — DETALLE DE FICHAJES
      // ══════════════════════════════════════════════════════════════
      const ws2 = wb.addWorksheet("Fichajes detallados");
      ws2.columns = [
        { width: 14 }, // Fecha
        { width: 14 }, // Día semana
        { width: 26 }, // Empleado
        { width: 16 }, // Estado
        { width: 32 }, // Obra
        { width: 11 }, // Fichado
        { width: 20 }, // Hora fichaje
        { width: 36 }, // Nota
      ];

      // Fila 1 — Título
      ws2.mergeCells("A1:H1");
      const t21 = ws2.getCell("A1");
      t21.value     = "DETALLE DE FICHAJES";
      t21.font      = { name: "Calibri", bold: true, size: 14, color: { argb: BLANCO } };
      t21.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_OSCURO } };
      t21.alignment = { horizontal: "center", vertical: "middle" };
      ws2.getRow(1).height = 34;

      // Fila 2 — Cabeceras
      const cabeceras2 = ["Fecha", "Día semana", "Empleado", "Estado", "Obra", "Fichado", "Hora fichaje", "Nota"];
      const hRow2 = ws2.addRow(cabeceras2);
      hRow2.eachCell(cell => {
        cell.font      = { name: "Calibri", bold: true, size: 10, color: { argb: BLANCO } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_MEDIO } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border    = { bottom: { style: "medium", color: { argb: AZUL_OSCURO } } };
      });
      hRow2.height = 26;

      // Filas de datos — ordenadas por fecha → empleado
      const sorted = [...jornadas].sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        const nA = empleados.find(u => u.id === a.user_id)?.nombre ?? "";
        const nB = empleados.find(u => u.id === b.user_id)?.nombre ?? "";
        return nA.localeCompare(nB);
      });

      sorted.forEach(j => {
        const emp  = empleados.find(u => u.id === j.user_id);
        if (!emp) return;
        const obra       = obras.find(o => o.id === j.obra_id);
        const fechaDate  = new Date(j.fecha + "T12:00:00");
        const diaSemana  = format(fechaDate, "EEEE", { locale: es });
        const horaFichaje = j.fichado_at
          ? format(new Date(j.fichado_at), "dd/MM/yyyy HH:mm", { locale: es })
          : "";

        const row = ws2.addRow([
          j.fecha,
          diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
          emp.nombre,
          ESTADO_LABELS[j.estado] ?? j.estado,
          obra?.nombre ?? "—",
          j.ha_fichado ? "✓ Sí" : "No",
          horaFichaje,
          j.nota ?? "",
        ]);

        const bg = ESTADO_COLORS[j.estado] ?? BLANCO;
        row.eachCell(cell => {
          cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font   = { name: "Calibri", size: 10 };
          cell.border = { bottom: borderHair };
        });
        // Fichado en verde si sí
        if (j.ha_fichado) {
          ws2.getRow(row.number).getCell(6).font = {
            name: "Calibri", size: 10, bold: true, color: { argb: "FF065F46" },
          };
        }
        row.height = 20;
      });

      // Congelar cabeceras
      ws2.views = [{ state: "frozen", ySplit: 2 }];

      // ── 3. Generar y descargar ───────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `ReforLife_Fichajes_${fechaInicio}_${fechaFin}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error("[ExportExcel]", e);
      setError("Error al generar el Excel. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel w-full max-w-sm p-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="icon-container">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-content-primary text-base">Exportar fichajes</h2>
              <p className="text-xs text-content-muted">Excel con resumen y detalle completo</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label className="label">Fecha inicio</label>
            <input
              type="date"
              className="input"
              value={fechaInicio}
              onChange={e => { setFechaInicio(e.target.value); setError(null); }}
            />
          </div>
          <div>
            <label className="label">Fecha fin</label>
            <input
              type="date"
              className="input"
              value={fechaFin}
              min={fechaInicio}
              onChange={e => { setFechaFin(e.target.value); setError(null); }}
            />
          </div>

          {/* Info */}
          <div className="flex items-start gap-2.5 bg-primary-light/50 rounded-xl p-3">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-content-secondary leading-relaxed">
              El Excel incluirá <strong>2 hojas</strong>:
              <br />· <strong>Resumen</strong> — días y totales por empleado
              <br />· <strong>Fichajes detallados</strong> — cada jornada con estado, obra y hora
            </p>
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger-light/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={exportar}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
            ) : (
              <><Download className="w-4 h-4" /> Descargar Excel</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
