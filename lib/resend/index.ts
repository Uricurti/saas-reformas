import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM ?? "onboarding@resend.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://reforlife.app";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function baseTemplate(contenido: string) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ReforLife</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(96,126,170,0.10);">
        <!-- Cabecera -->
        <tr>
          <td style="background:linear-gradient(135deg,#1c3879 0%,#607eaa 100%);padding:28px 32px;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">ReforLife</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Gestión de reformas</p>
          </td>
        </tr>
        <!-- Contenido -->
        <tr>
          <td style="padding:32px;">
            ${contenido}
          </td>
        </tr>
        <!-- Pie -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f4;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              ReforLife · Gestión de obras y reformas<br/>
              <a href="${APP_URL}" style="color:#607eaa;text-decoration:none;">Abrir la app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function botonPrimario(texto: string, href: string) {
  return `
  <a href="${href}" style="display:inline-block;margin-top:20px;background:#607eaa;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:700;font-size:15px;">
    ${texto}
  </a>`;
}

// ─── 1. Nueva obra asignada ───────────────────────────────────────────────────
export async function sendEmailAsignacion(params: {
  to:          string;
  nombre:      string;
  obraNombre:  string;
  obraDireccion: string;
  fechaInicio: string;      // YYYY-MM-DD
  fechaFin?:   string;
  horaInicio?: string;
}) {
  const fechaFormateada = new Date(params.fechaInicio + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const fechaFinFormateada = params.fechaFin
    ? new Date(params.fechaFin + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const contenido = `
    <h2 style="margin:0 0 6px;color:#111827;font-size:20px;font-weight:700;">Nueva obra asignada 📋</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Hola <strong>${params.nombre.split(" ")[0]}</strong>, tienes una nueva asignación.</p>

    <div style="background:#f4f6fb;border-radius:14px;padding:20px 22px;margin-bottom:8px;">
      <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Obra</p>
      <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#111827;">${params.obraNombre}</p>
      <p style="margin:0;font-size:14px;color:#607eaa;">📍 ${params.obraDireccion}</p>
    </div>

    <div style="background:#f4f6fb;border-radius:14px;padding:20px 22px;margin-top:10px;">
      <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Fechas</p>
      <p style="margin:0 0 4px;font-size:14px;color:#111827;">🗓️ Inicio: <strong>${fechaFormateada}</strong></p>
      ${params.horaInicio ? `<p style="margin:4px 0;font-size:14px;color:#111827;">🕐 Hora: <strong>${params.horaInicio}</strong></p>` : ""}
      ${fechaFinFormateada ? `<p style="margin:4px 0 0;font-size:14px;color:#111827;">🏁 Fin estimado: <strong>${fechaFinFormateada}</strong></p>` : ""}
    </div>

    ${botonPrimario("Ver en la app →", APP_URL + "/obras")}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      params.to,
    subject: `Nueva obra asignada: ${params.obraNombre}`,
    html:    baseTemplate(contenido),
  });
}

// ─── 2. Recordatorio de fichaje ───────────────────────────────────────────────
export async function sendEmailFichajeReminder(params: {
  to:          string;
  nombre:      string;
  obraNombre?: string;
}) {
  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const contenido = `
    <h2 style="margin:0 0 6px;color:#111827;font-size:20px;font-weight:700;">Recordatorio de fichaje ⏰</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Hola <strong>${params.nombre.split(" ")[0]}</strong>, parece que hoy no has fichado todavía.</p>

    <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:14px;padding:20px 22px;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#92400e;">🗓️ ${hoy}</p>
      ${params.obraNombre ? `<p style="margin:0;font-size:14px;color:#b45309;">Obra: <strong>${params.obraNombre}</strong></p>` : ""}
      <p style="margin:8px 0 0;font-size:13px;color:#b45309;">Recuerda registrar tu jornada para que quede correctamente anotada.</p>
    </div>

    ${botonPrimario("Fichar ahora →", APP_URL + "/obras")}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      params.to,
    subject: "⏰ Recuerda fichar hoy",
    html:    baseTemplate(contenido),
  });
}

// ─── 3. Obra de mañana ────────────────────────────────────────────────────────
export async function sendEmailObraManana(params: {
  to:           string;
  nombre:       string;
  obraNombre:   string;
  obraDireccion: string;
  horaInicio?:  string;
}) {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const mananaFormateada = manana.toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const contenido = `
    <h2 style="margin:0 0 6px;color:#111827;font-size:20px;font-weight:700;">Tu obra de mañana 🏗️</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Hola <strong>${params.nombre.split(" ")[0]}</strong>, aquí tienes los detalles de mañana.</p>

    <div style="background:#f4f6fb;border-radius:14px;padding:20px 22px;">
      <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">📅 ${mananaFormateada}</p>
      <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#111827;">${params.obraNombre}</p>
      <p style="margin:0 0 10px;font-size:14px;color:#607eaa;">📍 ${params.obraDireccion}</p>
      ${params.horaInicio
        ? `<div style="display:inline-block;background:#607eaa;color:#fff;border-radius:8px;padding:6px 14px;font-size:14px;font-weight:700;">🕐 ${params.horaInicio}</div>`
        : `<p style="margin:0;font-size:13px;color:#9ca3af;">Hora: consulta con tu responsable</p>`
      }
    </div>

    <div style="margin-top:14px;padding:14px 18px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;">
      <p style="margin:0;font-size:13px;color:#166534;">💡 Pulsa en la dirección para abrir Google Maps</p>
    </div>

    ${botonPrimario("Ver en la app →", APP_URL + "/obras")}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      params.to,
    subject: `🏗️ Mañana trabajas en: ${params.obraNombre}`,
    html:    baseTemplate(contenido),
  });
}
