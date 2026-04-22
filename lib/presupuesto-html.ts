/**
 * Generador de HTML del documento de presupuesto (sin React / sin JSX).
 *
 * Usado por la API route /api/presupuestos/pdf para generar el HTML que
 * Puppeteer renderizará como PDF. Produce exactamente el mismo diseño que
 * el componente PresupuestoDocument.tsx.
 */
import { format } from "date-fns";
import { es }     from "date-fns/locale";

// ── Helpers de formato ────────────────────────────────────────────────────────
function fmtE(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(d: string | null): string {
  if (!d) return "—";
  try { return format(new Date(d), "dd 'de' MMMM 'de' yyyy", { locale: es }); } catch { return d; }
}
function parseSeccion(s: string): { tipo: string; nombre: string } {
  const idx = s.indexOf(":");
  if (idx === -1) return { tipo: "otros", nombre: s };
  return { tipo: s.substring(0, idx), nombre: s.substring(idx + 1) };
}
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Colores / constantes ──────────────────────────────────────────────────────
const PRIMARY    = "#607eaa";
const TEXT_DARK  = "#1A1A2E";
const TEXT_MID   = "#4A5568";
const TEXT_SOFT  = "#6b7280";
const TEXT_FAINT = "#94a3b8";
const BG_LIGHT   = "#EEF2F8";

const TIPO_LABEL: Record<string, string> = {
  bano:   "Reforma de baño",
  cocina: "Reforma de cocina",
  otros:  "Reforma integral",
  mixto:  "Reforma completa",
};
const SECCION_COLOR: Record<string, string> = {
  bano:   "#607eaa",
  cocina: "#EA580C",
  otros:  "#4B5563",
};

// ── Tipos mínimos (sin importar desde @/types para no arrastrar deps) ─────────
interface Linea {
  id?: string;
  nombre_partida: string;
  descripcion?: string | null;
  precio: number;
  es_base: boolean;
  seccion?: string | null;
  orden?: number;
}
interface Presupuesto {
  id: string;
  numero: string;
  version: number;
  tipo: string;
  cliente_nombre: string;
  cliente_apellidos?: string | null;
  cliente_nif?: string | null;
  cliente_telefono?: string | null;
  cliente_email?: string | null;
  cliente_direccion?: string | null;
  cliente_cp?: string | null;
  cliente_ciudad?: string | null;
  fecha_emision: string;
  fecha_validez: string;
  importe_base: number;
  porcentaje_iva: number;
  importe_iva: number;
  importe_total: number;
  forma_pago?: { concepto: string; porcentaje: number }[];
  lineas: Linea[];
}
interface Config {
  empresa_nombre?: string | null;
  empresa_cif?: string | null;
  empresa_direccion?: string | null;
  empresa_telefono?: string | null;
  empresa_email?: string | null;
  numero_cuenta?: string | null;
}

// ── Filas de partidas (compartido entre modo simple y multi-sección) ──────────
function filaPartida(l: Linea, i: number): string {
  return `
    <div style="display:flex;align-items:flex-start;padding:11px 14px;
      background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};
      border-bottom:1px solid #f0f0f5;
      page-break-inside:avoid;break-inside:avoid;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:${TEXT_DARK};">${esc(l.nombre_partida)}</div>
        ${l.descripcion ? `<div style="font-size:11px;color:${TEXT_SOFT};margin-top:2px;line-height:1.5;">${esc(l.descripcion)}</div>` : ""}
      </div>
      <div style="width:120px;font-size:14px;font-weight:700;color:${TEXT_DARK};text-align:right;padding-top:1px;">
        ${fmtE(l.precio)}
      </div>
    </div>`;
}

// ── Función principal ─────────────────────────────────────────────────────────
/**
 * Padding extra (px) inyectado antes de cada separador entre secciones.
 * Clave: índice del separador (0 = antes de la sección 1, 1 = antes de la 2, etc.)
 * Calculado en la doble-pasada de Puppeteer para distribuir espacios en blanco.
 */
export type PaddingOverrides = Record<number, number>;

export function buildPresupuestoHtml(
  presupuesto: Presupuesto,
  config: Config | null,
  logoDataUrl: string,
  paddingOverrides: PaddingOverrides = {},
): string {
  const lineas         = presupuesto.lineas ?? [];
  const tieneSecciones = lineas.some((l) => l.seccion);

  // ── Agrupar secciones si aplica ───────────────────────────────────────────
  type Seccion = { nombre: string; tipo: string; lineas: Linea[] };
  const secciones: Seccion[] = [];
  if (tieneSecciones) {
    const orden: string[]               = [];
    const mapa: Record<string, Linea[]> = {};
    for (const l of lineas) {
      const key = l.seccion ?? "__sin_seccion__";
      if (!mapa[key]) { mapa[key] = []; orden.push(key); }
      mapa[key].push(l);
    }
    for (const key of orden) {
      if (key === "__sin_seccion__") {
        secciones.push({ nombre: "Otras partidas", tipo: "otros", lineas: mapa[key] });
      } else {
        const { tipo, nombre } = parseSeccion(key);
        secciones.push({ nombre, tipo, lineas: mapa[key] });
      }
    }
  }

  const lineasBase  = lineas.filter((l) => l.es_base);
  const lineasExtra = lineas.filter((l) => !l.es_base);

  // ── Bloque cabecera empresa ───────────────────────────────────────────────
  const cabeceraDer = `
    <div style="text-align:right;">
      <div style="font-size:10px;font-weight:700;color:${TEXT_FAINT};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Presupuesto</div>
      <div style="font-size:28px;font-weight:900;color:${TEXT_DARK};letter-spacing:-1px;line-height:1;">
        ${esc(presupuesto.numero)}
        ${presupuesto.version > 1 ? `<span style="font-size:14px;font-weight:600;color:${TEXT_FAINT};margin-left:6px;">v${presupuesto.version}</span>` : ""}
      </div>
      <div style="font-size:12px;color:${TEXT_SOFT};margin-top:6px;">Fecha: ${fmtDate(presupuesto.fecha_emision)}</div>
      <div style="font-size:12px;color:#ef4444;font-weight:600;margin-top:3px;">Válido hasta: ${fmtDate(presupuesto.fecha_validez)}</div>
    </div>`;

  const cabeceraIzq = `
    <div style="max-width:320px;">
      <div style="margin-bottom:10px;">
        <img src="${logoDataUrl}" alt="ReforLife" style="height:44px;width:132px;display:block;object-fit:contain;object-position:left center;" />
      </div>
      ${config?.empresa_cif     ? `<div style="font-size:12px;color:${TEXT_SOFT};margin-bottom:2px;"><strong style="color:${TEXT_MID};">CIF:</strong> ${esc(config.empresa_cif)}</div>` : ""}
      ${config?.empresa_direccion ? `<div style="font-size:12px;color:${TEXT_SOFT};">${esc(config.empresa_direccion)}</div>` : ""}
      ${config?.empresa_telefono  ? `<div style="font-size:12px;color:${TEXT_SOFT};">${esc(config.empresa_telefono)}</div>` : ""}
      ${config?.empresa_email     ? `<div style="font-size:12px;color:${TEXT_SOFT};">${esc(config.empresa_email)}</div>` : ""}
    </div>`;

  // ── Bloque cliente ────────────────────────────────────────────────────────
  const clienteNombreCompleto = [presupuesto.cliente_nombre, presupuesto.cliente_apellidos].filter(Boolean).join(" ");
  const clienteDireccionCompleta = [
    presupuesto.cliente_cp,
    presupuesto.cliente_ciudad,
  ].filter(Boolean).join(" ");

  const bloqueCliente = `
    <div style="flex:1;padding:16px 20px;background:#f9fafb;border-radius:10px;border-left:3px solid ${PRIMARY};">
      <div style="font-size:9px;font-weight:700;color:${TEXT_FAINT};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Presupuesto para</div>
      <div style="font-size:15px;font-weight:700;color:${TEXT_DARK};margin-bottom:4px;">${esc(clienteNombreCompleto)}</div>
      ${presupuesto.cliente_nif      ? `<div style="font-size:12px;color:${TEXT_SOFT};margin-bottom:1px;"><strong style="color:${TEXT_MID};">NIF/CIF:</strong> ${esc(presupuesto.cliente_nif)}</div>` : ""}
      ${presupuesto.cliente_telefono ? `<div style="font-size:12px;color:${TEXT_SOFT};margin-bottom:1px;">${esc(presupuesto.cliente_telefono)}</div>` : ""}
      ${presupuesto.cliente_email    ? `<div style="font-size:12px;color:${TEXT_SOFT};margin-bottom:1px;">${esc(presupuesto.cliente_email)}</div>` : ""}
      ${presupuesto.cliente_direccion ? `
        <div style="font-size:12px;color:${TEXT_SOFT};">
          ${esc(presupuesto.cliente_direccion)}
          ${clienteDireccionCompleta ? ` · ${esc(clienteDireccionCompleta)}` : ""}
        </div>` : ""}
    </div>`;

  const numPartidas = lineas.length;
  const numSecciones = secciones.length;
  const bloqueDetalle = tieneSecciones
    ? `${numSecciones} sección${numSecciones !== 1 ? "es" : ""} · ${numPartidas} partidas`
    : `${numPartidas} partida${numPartidas !== 1 ? "s" : ""} incluida${numPartidas !== 1 ? "s" : ""}`;

  const bloqueTipo = `
    <div style="flex:1;padding:16px 20px;background:#f9fafb;border-radius:10px;border-left:3px solid #26bbec;">
      <div style="font-size:9px;font-weight:700;color:${TEXT_FAINT};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Tipo de reforma</div>
      <div style="font-size:18px;font-weight:800;color:${TEXT_DARK};">${esc(TIPO_LABEL[presupuesto.tipo] ?? presupuesto.tipo)}</div>
      <div style="font-size:12px;color:${TEXT_SOFT};margin-top:6px;">${bloqueDetalle}</div>
    </div>`;

  // ── Tabla de partidas ─────────────────────────────────────────────────────
  let tablaPartidas = "";
  if (tieneSecciones) {
    tablaPartidas = secciones.map((sec, secIdx) => {
      const subtotal    = sec.lineas.reduce((s, l) => s + l.precio, 0);
      const accentColor = SECCION_COLOR[sec.tipo] ?? PRIMARY;
      const isLast      = secIdx === secciones.length - 1;
      const header      = `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:9px 14px;background:${accentColor}22;
          border-left:3px solid ${accentColor};
          border-bottom:1px solid ${accentColor}44;">
          <div style="font-size:11px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:0.08em;">${esc(sec.nombre)}</div>
          <div style="font-size:12px;font-weight:700;color:${TEXT_MID};">Subtotal: ${fmtE(subtotal)}</div>
        </div>`;

      // Secciones cortas (≤4 filas): evitar que se partan entre páginas
      if (sec.lineas.length <= 4) {
        return `
          <div style="break-inside:avoid;page-break-inside:avoid;">
            ${header}
            ${sec.lineas.map((l, i) => filaPartida(l, i)).join("")}
          </div>
          ${!isLast ? `<div data-sep-idx="${secIdx}" style="height:2px;background:#e5e7eb;margin-top:${6 + (paddingOverrides[secIdx] ?? 0)}px;margin-bottom:6px;"></div>` : ""}`;
      }

      // Secciones largas: agrupar header + primeras 2 filas para que el
      // header nunca quede solo o con solo 1 fila al final de una página
      const filasPrimeras = sec.lineas.slice(0, 2).map((l, i) => filaPartida(l, i)).join("");
      const filasResto    = sec.lineas.slice(2).map((l, i) => filaPartida(l, i + 2)).join("");
      return `
        <div>
          <div style="break-inside:avoid;page-break-inside:avoid;">
            ${header}
            ${filasPrimeras}
          </div>
          ${filasResto}
        </div>
        ${!isLast ? `<div data-sep-idx="${secIdx}" style="height:2px;background:#e5e7eb;margin-top:${6 + (paddingOverrides[secIdx] ?? 0)}px;margin-bottom:6px;"></div>` : ""}`;
    }).join("");
  } else {
    tablaPartidas = lineasBase.map((l, i) => filaPartida(l, i)).join("");
    if (lineasExtra.length > 0) {
      tablaPartidas += `
        ${lineasBase.length > 0 ? `
          <div style="display:flex;align-items:center;padding:8px 14px;background:${BG_LIGHT};">
            <div style="flex:1;font-size:10px;font-weight:700;color:${PRIMARY};letter-spacing:0.1em;text-transform:uppercase;">Extras y opcionales</div>
          </div>` : ""}
        ${lineasExtra.map((l, i) => filaPartida(l, i)).join("")}`;
    }
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const subtotalesSecciones = tieneSecciones
    ? secciones.map((sec, i) => `
        <div key="${i}" style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f5;">
          <span style="font-size:12px;color:${TEXT_SOFT};">${esc(sec.nombre)}</span>
          <span style="font-size:12px;font-weight:600;color:${TEXT_MID};">${fmtE(sec.lineas.reduce((s, l) => s + l.precio, 0))}</span>
        </div>`).join("") + `<div style="height:8px;"></div>`
    : "";

  // ── Forma de pago ─────────────────────────────────────────────────────────
  const formaPago = presupuesto.forma_pago ?? [];
  const iban      = config?.numero_cuenta;
  const bloqueFormaPago = (formaPago.length > 0 || iban) ? `
    <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:12px 18px;margin-bottom:24px;page-break-inside:avoid;">
      <div style="font-size:9px;font-weight:700;color:#0284c7;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Condiciones de pago</div>
      ${formaPago.length > 0 ? `
        <div style="font-size:12px;color:${TEXT_MID};margin-bottom:${iban ? "8px" : "0"};">
          ${formaPago.map((fp, i) => `${fp.porcentaje}% ${esc(fp.concepto)}${i < formaPago.length - 1 ? " · " : ""}`).join("")}
        </div>` : ""}
      ${iban ? `<div style="font-size:12px;color:${TEXT_MID};margin-top:4px;">Transferencia bancaria · IBAN: ${esc(iban)}</div>` : ""}
    </div>` : "";

  // ── Condiciones ───────────────────────────────────────────────────────────
  const condiciones = [
    "La validez de este presupuesto es de 30 días desde su fecha de emisión.",
    "Si para la entrega de la mercancía fuese necesaria la contratación de un elevador exterior, el coste correrá a cargo del cliente.",
    "El cliente queda informado de que, al picar paredes para retirar la rajola existente o pasar nuevas instalaciones de electricidad y lampistería, los tabiques pueden verse afectados. Los trabajos de pintura necesarios para reparar zonas afectadas se presupuestarán aparte cuando corresponda.",
    "El tapado y enguixado de los agujeros sí está incluido en el presupuesto.",
    "En caso de que el planché existente no esté en condiciones para colocar el nuevo pavimento, se facturará aparte la ejecución de uno nuevo.",
    "Al colocar el nuevo pavimento sobre el planché existente, puede que no quede al mismo nivel que el resto de la vivienda debido a los diferentes grosores de la cerámica. Si se quiere igualar el nivel, será necesario ejecutar un planché nuevo.",
    "Las mamparas se suministrarán aproximadamente tres semanas después de haber finalizado la paletería, ya que el vidriero no puede tomar medidas exactas hasta que la obra esté terminada.",
    "Al instalar un mueble, accesorio u otro material, existe la posibilidad de perforar algún tubo, cable o romper alguna rajola. Si la obra no la ha ejecutado la empresa, los costes de reparación de estos elementos correrán a cargo del cliente.",
    "En obra de reforma completa de baño, se incluyen 5 mecanismos vistos Jung LS990 básicos, blancos o plata mate. Si se instalan más unidades o se cambia de modelo, se facturará aparte.",
  ];

  // ── HTML final ────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
    }
    body { background: #ffffff; }

    /*
     * @page controla los márgenes de impresión de Chrome.
     * Primera página: sin margen superior (el contenedor ya tiene 52px de padding).
     * Páginas 2 en adelante: 14mm arriba para que el contenido no quede pegado al borde.
     */
    @page          { margin: 14mm 0 10mm 0; }
    @page :first   { margin-top: 0; margin-bottom: 10mm; }

    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
<div style="background:#ffffff;width:794px;box-sizing:border-box;padding:52px 56px 44px;color:${TEXT_DARK};font-size:13px;line-height:1.55;">

  <!-- CABECERA -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;page-break-inside:avoid;break-inside:avoid;">
    ${cabeceraIzq}
    ${cabeceraDer}
  </div>

  <!-- LÍNEA DEGRADADA -->
  <div style="height:3px;background:linear-gradient(90deg,${PRIMARY},#26bbec 50%,transparent);border-radius:99px;margin-bottom:32px;"></div>

  <!-- CLIENTE + TIPO -->
  <div style="display:flex;gap:32px;margin-bottom:32px;page-break-inside:avoid;break-inside:avoid;">
    ${bloqueCliente}
    ${bloqueTipo}
  </div>

  <!-- TABLA DE PARTIDAS -->
  <div style="margin-bottom:32px;">
    <div style="display:flex;background:${TEXT_DARK};border-radius:8px 8px 0 0;padding:9px 14px;">
      <div style="flex:1;font-size:10px;font-weight:700;color:#ffffff;letter-spacing:0.06em;text-transform:uppercase;">Descripción</div>
      <div style="width:120px;font-size:10px;font-weight:700;color:#ffffff;text-align:right;letter-spacing:0.06em;">Precio</div>
    </div>
    ${tablaPartidas}
    <div style="height:2px;background:${TEXT_DARK};border-radius:0 0 4px 4px;"></div>
  </div>

  <!-- TOTALES -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px;page-break-inside:avoid;">
    <div style="width:340px;">
      ${subtotalesSecciones}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:13px;color:${TEXT_SOFT};">Base imponible</span>
        <span style="font-size:13px;font-weight:600;color:${TEXT_MID};">${fmtE(presupuesto.importe_base)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:13px;color:${TEXT_SOFT};">IVA (${presupuesto.porcentaje_iva}%)</span>
        <span style="font-size:13px;font-weight:600;color:${TEXT_MID};">${fmtE(presupuesto.importe_iva)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:${TEXT_DARK};border-radius:10px;margin-top:8px;">
        <span style="font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">TOTAL PRESUPUESTO</span>
        <span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${fmtE(presupuesto.importe_total)}</span>
      </div>
    </div>
  </div>

  <!-- FORMA DE PAGO + IBAN -->
  ${bloqueFormaPago}

  <!-- CONDICIONES -->
  <div style="margin-bottom:24px;page-break-inside:avoid;">
    <div style="font-size:9px;font-weight:700;color:${TEXT_FAINT};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Condiciones</div>
    <div style="font-size:10px;color:${TEXT_SOFT};line-height:1.7;">
      ${condiciones.map((c) => `
        <div style="display:flex;gap:6px;margin-bottom:3px;">
          <span style="flex-shrink:0;">–</span>
          <span>${esc(c)}</span>
        </div>`).join("")}
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1.5px solid ${BG_LIGHT};padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;break-inside:avoid;">
    <div style="font-size:10px;color:${TEXT_FAINT};max-width:380px;line-height:1.6;">
      Presupuesto válido 30 días desde la fecha de emisión. Los precios son orientativos y pueden variar en función de imprevistos o modificaciones durante la ejecución.
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px;">
      <img src="${logoDataUrl}" alt="ReforLife" style="height:26px;width:78px;display:block;object-fit:contain;object-position:right center;" />
    </div>
  </div>

</div>
</body>
</html>`;
}
