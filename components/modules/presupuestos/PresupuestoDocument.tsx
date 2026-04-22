import type { PresupuestoConLineas } from "@/types";
import type { TenantConfig } from "@/lib/insforge/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd 'de' MMMM 'de' yyyy", { locale: es }); } catch { return d; }
}

const TIPO_LABEL: Record<string, string> = {
  bano: "Reforma de baño",
  cocina: "Reforma de cocina",
  otros: "Reforma integral",
  mixto: "Reforma completa",
};

/** Parsea "bano:Baño 1" → { tipo: "bano", nombre: "Baño 1" } */
function parseSeccion(seccion: string): { tipo: string; nombre: string } {
  const colonIdx = seccion.indexOf(":");
  if (colonIdx === -1) return { tipo: "otros", nombre: seccion };
  return { tipo: seccion.substring(0, colonIdx), nombre: seccion.substring(colonIdx + 1) };
}

const SECCION_COLOR: Record<string, string> = {
  bano:   "#607eaa",
  cocina: "#EA580C",
  otros:  "#4B5563",
};

const PRIMARY   = "#607eaa";
const TEXT_DARK = "#1A1A2E";
const TEXT_MID  = "#4A5568";
const TEXT_SOFT = "#6b7280";
const TEXT_FAINT = "#94a3b8";
const BG_LIGHT  = "#EEF2F8";
const fontBase: React.CSSProperties = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  WebkitFontSmoothing: "antialiased",
};

export function PresupuestoDocument({
  presupuesto,
  config,
}: {
  presupuesto: PresupuestoConLineas;
  config: TenantConfig | null;
}) {
  // ── Determinar si es multi-sección ──────────────────────────────
  const tieneSecciones = presupuesto.lineas.some((l) => l.seccion);

  // Agrupar líneas por sección
  const secciones: { nombre: string; tipo: string; lineas: typeof presupuesto.lineas }[] = [];
  if (tieneSecciones) {
    const ordenSecciones: string[] = [];
    const mapaLineas: Record<string, typeof presupuesto.lineas> = {};
    for (const l of presupuesto.lineas) {
      const key = l.seccion ?? "__sin_seccion__";
      if (!mapaLineas[key]) { mapaLineas[key] = []; ordenSecciones.push(key); }
      mapaLineas[key].push(l);
    }
    for (const key of ordenSecciones) {
      if (key === "__sin_seccion__") {
        secciones.push({ nombre: "Otras partidas", tipo: "otros", lineas: mapaLineas[key] });
      } else {
        const { tipo, nombre } = parseSeccion(key);
        secciones.push({ nombre, tipo, lineas: mapaLineas[key] });
      }
    }
  }

  const lineasBase  = presupuesto.lineas.filter((l) => l.es_base);
  const lineasExtra = presupuesto.lineas.filter((l) => !l.es_base);

  return (
    <div
      id="presupuesto-doc"
      style={{
        ...fontBase,
        background: "#ffffff",
        width: "794px",
        boxSizing: "border-box",
        padding: "52px 56px 44px",
        color: TEXT_DARK,
        fontSize: "13px",
        lineHeight: "1.55",
      }}
    >
      {/* ══ CABECERA ═══════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ marginBottom: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/4.svg" alt="ReforLife" style={{ height: 44, width: 132, display: "block", objectFit: "contain", objectPosition: "left center" }} />
          </div>
          {config?.empresa_cif && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 2 }}>
              <strong style={{ color: TEXT_MID }}>CIF:</strong> {config.empresa_cif}
            </div>
          )}
          {config?.empresa_direccion && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_direccion}</div>}
          {config?.empresa_telefono && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_telefono}</div>}
          {config?.empresa_email && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_email}</div>}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            Presupuesto
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_DARK, letterSpacing: "-1px", lineHeight: 1 }}>
            {presupuesto.numero}
            {presupuesto.version > 1 && (
              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_FAINT, marginLeft: 6 }}>
                v{presupuesto.version}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>
            Fecha: {fmtDate(presupuesto.fecha_emision)}
          </div>
          <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginTop: 3 }}>
            Válido hasta: {fmtDate(presupuesto.fecha_validez)}
          </div>
        </div>
      </div>

      {/* ══ LÍNEA DEGRADADA ════════════════════════════════════════ */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, #26bbec 50%, transparent)`, borderRadius: 99, marginBottom: 32 }} />

      {/* ══ CLIENTE + TIPO ══════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32, pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div style={{ flex: 1, padding: "16px 20px", background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid ${PRIMARY}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Presupuesto para
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_DARK, marginBottom: 4 }}>
            {presupuesto.cliente_nombre}{presupuesto.cliente_apellidos ? " " + presupuesto.cliente_apellidos : ""}
          </div>
          {presupuesto.cliente_nif && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>
              <strong style={{ color: TEXT_MID }}>NIF/CIF:</strong> {presupuesto.cliente_nif}
            </div>
          )}
          {presupuesto.cliente_telefono && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>{presupuesto.cliente_telefono}</div>}
          {presupuesto.cliente_email && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>{presupuesto.cliente_email}</div>}
          {presupuesto.cliente_direccion && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}>
              {presupuesto.cliente_direccion}
              {(presupuesto.cliente_cp || presupuesto.cliente_ciudad) && (
                <span> · {[presupuesto.cliente_cp, presupuesto.cliente_ciudad].filter(Boolean).join(" ")}</span>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: "16px 20px", background: "#f9fafb", borderRadius: 10, borderLeft: "3px solid #26bbec" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Tipo de reforma
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_DARK }}>
            {TIPO_LABEL[presupuesto.tipo] ?? presupuesto.tipo}
          </div>
          <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>
            {tieneSecciones
              ? `${secciones.length} sección${secciones.length !== 1 ? "es" : ""} · ${presupuesto.lineas.length} partidas`
              : `${presupuesto.lineas.length} partida${presupuesto.lineas.length !== 1 ? "s" : ""} incluida${presupuesto.lineas.length !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {/* ══ TABLA DE PARTIDAS ═══════════════════════════════════════ */}
      <div style={{ marginBottom: 32 }}>
        {/* Cabecera tabla */}
        <div style={{ display: "flex", background: TEXT_DARK, borderRadius: "8px 8px 0 0", padding: "9px 14px" }}>
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#ffffff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Descripción
          </div>
          <div style={{ width: 120, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "right", letterSpacing: "0.06em" }}>
            Precio
          </div>
        </div>

        {tieneSecciones ? (
          /* ── Vista MULTI-SECCIÓN ── */
          <>
            {secciones.map((sec, secIdx) => {
              const subtotal    = sec.lineas.reduce((s, l) => s + l.precio, 0);
              const accentColor = SECCION_COLOR[sec.tipo] ?? PRIMARY;
              const isLast      = secIdx === secciones.length - 1;
              return (
                // SIN pageBreakInside:avoid en el wrapper → evita páginas en blanco
                // cuando la sección es más larga que una página
                <div key={secIdx}>
                  {/* Header de sección — breakAfter avoid: el header no queda solo al final de página */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 14px",
                    background: `${accentColor}14`,
                    borderLeft: `3px solid ${accentColor}`,
                    borderBottom: `1px solid ${accentColor}30`,
                    breakAfter: "avoid",
                    pageBreakAfter: "avoid",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {sec.nombre}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MID }}>
                      Subtotal: {fmtE(subtotal)}
                    </div>
                  </div>

                  {/* Partidas — pageBreakInside:avoid solo en cada fila individual */}
                  {sec.lineas.map((l, i) => (
                    <div key={l.id ?? i} style={{
                      display: "flex", alignItems: "flex-start", padding: "11px 14px",
                      background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                      borderBottom: "1px solid #f0f0f5",
                      pageBreakInside: "avoid",
                      breakInside: "avoid",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_DARK }}>{l.nombre_partida}</div>
                        {l.descripcion && (
                          <div style={{ fontSize: 11, color: TEXT_SOFT, marginTop: 2, lineHeight: 1.5 }}>{l.descripcion}</div>
                        )}
                      </div>
                      <div style={{ width: 120, fontSize: 14, fontWeight: 700, color: TEXT_DARK, textAlign: "right", paddingTop: 1 }}>
                        {fmtE(l.precio)}
                      </div>
                    </div>
                  ))}

                  {/* Separador entre secciones */}
                  {!isLast && (
                    <div style={{ height: 2, background: "#e5e7eb", margin: "6px 0" }} />
                  )}
                </div>
              );
            })}
          </>
        ) : (
          /* ── Vista SINGLE (comportamiento original) ── */
          <>
            {lineasBase.map((l, i) => (
              <div key={l.id ?? i} style={{
                display: "flex", alignItems: "flex-start", padding: "12px 14px",
                background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                borderBottom: "1px solid #f0f0f5",
                pageBreakInside: "avoid",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_DARK }}>{l.nombre_partida}</div>
                  {l.descripcion && (
                    <div style={{ fontSize: 11, color: TEXT_SOFT, marginTop: 2, lineHeight: 1.5 }}>{l.descripcion}</div>
                  )}
                </div>
                <div style={{ width: 120, fontSize: 14, fontWeight: 700, color: TEXT_DARK, textAlign: "right", paddingTop: 1 }}>
                  {fmtE(l.precio)}
                </div>
              </div>
            ))}

            {lineasExtra.length > 0 && (
              <>
                {lineasBase.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", background: BG_LIGHT }}>
                    <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: PRIMARY, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Extras y opcionales
                    </div>
                  </div>
                )}
                {lineasExtra.map((l, i) => (
                  <div key={l.id ?? i} style={{
                    display: "flex", alignItems: "flex-start", padding: "12px 14px",
                    background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                    borderBottom: "1px solid #f0f0f5",
                    pageBreakInside: "avoid",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_DARK }}>{l.nombre_partida}</div>
                      {l.descripcion && (
                        <div style={{ fontSize: 11, color: TEXT_SOFT, marginTop: 2, lineHeight: 1.5 }}>{l.descripcion}</div>
                      )}
                    </div>
                    <div style={{ width: 120, fontSize: 14, fontWeight: 700, color: TEXT_DARK, textAlign: "right", paddingTop: 1 }}>
                      {fmtE(l.precio)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        <div style={{ height: 2, background: TEXT_DARK, borderRadius: "0 0 4px 4px" }} />
      </div>

      {/* ══ TOTALES ════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28, pageBreakInside: "avoid" }}>
        <div style={{ width: 340 }}>
          {/* Subtotales por sección (solo si hay secciones) */}
          {tieneSecciones && secciones.map((sec, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f5" }}>
              <span style={{ fontSize: 12, color: TEXT_SOFT }}>{sec.nombre}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MID }}>
                {fmtE(sec.lineas.reduce((s, l) => s + l.precio, 0))}
              </span>
            </div>
          ))}
          {tieneSecciones && <div style={{ height: 8 }} />}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: TEXT_SOFT }}>Base imponible</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtE(presupuesto.importe_base)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: TEXT_SOFT }}>IVA ({presupuesto.porcentaje_iva}%)</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtE(presupuesto.importe_iva)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: TEXT_DARK, borderRadius: 10, marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em" }}>TOTAL PRESUPUESTO</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>{fmtE(presupuesto.importe_total)}</span>
          </div>
        </div>
      </div>

      {/* ══ FORMA DE PAGO + IBAN ═══════════════════════════════════ */}
      {(presupuesto.forma_pago?.length > 0 || (config as any)?.numero_cuenta) && (
        <div style={{
          background: "#f0f9ff", border: "1.5px solid #bae6fd",
          borderRadius: 10, padding: "12px 18px", marginBottom: 24,
          pageBreakInside: "avoid",
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            Condiciones de pago
          </div>
          {presupuesto.forma_pago?.length > 0 && (
            <div style={{ fontSize: 12, color: TEXT_MID, marginBottom: (config as any)?.numero_cuenta ? 8 : 0 }}>
              {presupuesto.forma_pago.map((fp, i) => (
                <span key={i}>
                  {fp.porcentaje}% {fp.concepto}
                  {i < presupuesto.forma_pago.length - 1 ? " · " : ""}
                </span>
              ))}
            </div>
          )}
          {(config as any)?.numero_cuenta && (
            <div style={{ fontSize: 12, color: TEXT_MID, marginTop: 4 }}>
              Transferencia bancaria · IBAN: {(config as any).numero_cuenta}
            </div>
          )}
        </div>
      )}

      {/* ══ CONDICIONES ══════════════════════════════════════════ */}
      <div style={{ marginBottom: 24, pageBreakInside: "avoid" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          Condiciones
        </div>
        <div style={{ margin: 0, fontSize: 10, color: TEXT_SOFT, lineHeight: 1.7 }}>
          {[
            "La validez de este presupuesto es de 30 días desde su fecha de emisión.",
            "Si para la entrega de la mercancía fuese necesaria la contratación de un elevador exterior, el coste correrá a cargo del cliente.",
            "El cliente queda informado de que, al picar paredes para retirar la rajola existente o pasar nuevas instalaciones de electricidad y lampistería, los tabiques pueden verse afectados. Los trabajos de pintura necesarios para reparar zonas afectadas se presupuestarán aparte cuando corresponda.",
            "El tapado y enguixado de los agujeros sí está incluido en el presupuesto.",
            "En caso de que el planché existente no esté en condiciones para colocar el nuevo pavimento, se facturará aparte la ejecución de uno nuevo.",
            "Al colocar el nuevo pavimento sobre el planché existente, puede que no quede al mismo nivel que el resto de la vivienda debido a los diferentes grosores de la cerámica. Si se quiere igualar el nivel, será necesario ejecutar un planché nuevo.",
            "Las mamparas se suministrarán aproximadamente tres semanas después de haber finalizado la paletería, ya que el vidriero no puede tomar medidas exactas hasta que la obra esté terminada.",
            "Al instalar un mueble, accesorio u otro material, existe la posibilidad de perforar algún tubo, cable o romper alguna rajola. Si la obra no la ha ejecutado la empresa, los costes de reparación de estos elementos correrán a cargo del cliente.",
            "En obra de reforma completa de baño, se incluyen 5 mecanismos vistos Jung LS990 básicos, blancos o plata mate. Si se instalan más unidades o se cambia de modelo, se facturará aparte.",
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
              <span style={{ flexShrink: 0 }}>–</span>
              <span>{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ FOOTER ════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1.5px solid #EEF2F8", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", breakInside: "avoid" }}>
        <div style={{ fontSize: 10, color: TEXT_FAINT, maxWidth: 380, lineHeight: 1.6 }}>
          Presupuesto válido 30 días desde la fecha de emisión. Los precios son orientativos y pueden variar en función de imprevistos o modificaciones durante la ejecución.
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/4.svg" alt="ReforLife" style={{ height: 26, width: 78, display: "block", objectFit: "contain", objectPosition: "right center" }} />
        </div>
      </div>
    </div>
  );
}
