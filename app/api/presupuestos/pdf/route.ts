/**
 * API Route: generación de PDF de presupuesto con Puppeteer + Chromium headless.
 *
 * GET /api/presupuestos/pdf?id=XXX&tenantId=YYY
 *   → devuelve el PDF como application/pdf
 *
 * En desarrollo local usa el Chrome instalado en el sistema.
 * En producción (Vercel) usa @sparticuz/chromium-min descargando el ejecutable
 * desde GitHub Releases la primera vez (queda cacheado en /tmp).
 */
import { NextRequest, NextResponse }           from "next/server";
import { buildPresupuestoHtml, PaddingOverrides } from "@/lib/presupuesto-html";
import fs   from "fs";
import path from "path";

// Vercel: tiempo máximo de la función (segundos). Requiere plan Pro o superior.
export const maxDuration = 60;

// ── Credenciales InsForge (solo servidor) ─────────────────────────────────────
const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function fetchAdmin(apiPath: string) {
  const res = await fetch(`${INSFORGE_URL}${apiPath}`, {
    headers: { "x-api-key": SERVICE_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

// ── Lanzar Puppeteer según entorno ────────────────────────────────────────────
async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;

    // Leer la versión exacta instalada para construir la URL correcta.
    // Se puede sobreescribir con CHROMIUM_URL si el release de GitHub tiene otro nombre.
    let chromiumVersion = "131.0.0"; // fallback conservador
    try {
      const pkgPath = path.join(process.cwd(), "node_modules", "@sparticuz", "chromium-min", "package.json");
      chromiumVersion = JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
    } catch { /* usa fallback */ }

    const chromiumUrl = process.env.CHROMIUM_URL ??
      `https://github.com/Sparticuz/chromium/releases/download/v${chromiumVersion}/chromium-v${chromiumVersion}-pack.tar`;

    const executablePath = await chromium.executablePath(chromiumUrl);

    return puppeteer.launch({
      args:            [...chromium.args, "--no-sandbox"],
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless:        true,
    });
  }

  // Desarrollo local: buscar Chrome/Chromium instalado en el sistema
  const localPaths =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
        ];

  const executablePath = localPaths.find((p) => fs.existsSync(p));
  if (!executablePath) {
    throw new Error(
      "No se encontró Chrome/Chromium en el sistema. " +
      "Instala Google Chrome para generar PDFs en desarrollo."
    );
  }

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

// ── Handler GET ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id       = searchParams.get("id");
  const tenantId = searchParams.get("tenantId");

  if (!id || !tenantId) {
    return NextResponse.json({ error: "id y tenantId requeridos" }, { status: 400 });
  }

  // ── 1. Obtener datos en paralelo ─────────────────────────────────────────
  const [presData, lineasData, configData] = await Promise.all([
    fetchAdmin(`/api/database/records/presupuestos?id=eq.${id}`),
    fetchAdmin(`/api/database/records/lineas_presupuesto?presupuesto_id=eq.${id}&order=orden.asc`),
    fetchAdmin(`/api/database/records/tenant_config?tenant_id=eq.${tenantId}`),
  ]);

  const presupuesto = Array.isArray(presData) ? presData[0] : presData;
  if (!presupuesto) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  presupuesto.lineas = lineasData ?? [];
  const config = Array.isArray(configData) ? configData[0] : (configData ?? null);

  // ── 2. Logo → base64 para que Puppeteer lo renderice sin servidor web ────
  let logoDataUrl = "";
  try {
    const logoPath   = path.join(process.cwd(), "public", "logo", "4.svg");
    const logoBuffer = fs.readFileSync(logoPath);
    logoDataUrl = `data:image/svg+xml;base64,${logoBuffer.toString("base64")}`;
  } catch {
    // Si falla, el logo no aparece pero el PDF se genera igualmente
  }

  // ── 3. Generar HTML completo (sin React, módulo puro) ────────────────────
  const fullHtml = buildPresupuestoHtml(presupuesto, config, logoDataUrl);

  // ── 4. Puppeteer: doble pasada para paginación inteligente ──────────────
  //
  // Pasada 1: renderizar y medir en qué posición Y cae cada separador entre
  //           secciones. Si alguno empieza "muy arriba" en su página (indica
  //           mucho espacio vacío al final de la página anterior), calculamos
  //           cuánto padding añadir antes para redistribuir ese espacio.
  // Pasada 2: si hay ajustes, regenerar el HTML y producir el PDF final.
  //           Si no hay ajustes, usar directamente el render de la pasada 1.
  //
  // Altura A4 en px a 96 DPI con @page margin 14mm top (páginas 2+):
  //   297mm total − 14mm top − 10mm bottom = 273mm ≈ 1031px disponibles.
  // Primera página: 297mm − 0 − 10mm = 287mm ≈ 1084px.
  const ALTURA_PAGINA_CONT = 1031; // px de contenido por página (2ª en adelante)

  let pdfBytes: Uint8Array | null = null;
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // ── Pasada 1 ────────────────────────────────────────────────────────
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Medir la posición Y absoluta de cada separador entre secciones
    const sepPositions: { idx: number; top: number }[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("[data-sep-idx]")).map((el) => ({
        idx: parseInt((el as HTMLElement).dataset.sepIdx ?? "0", 10),
        top: (el as HTMLElement).getBoundingClientRect().top + window.scrollY,
      }));
    });

    // Calcular ajustes de padding
    // Primera página ocupa ~1084px. Las demás ~1031px.
    const PRIMERA_PAGINA = 1084;
    const paddingOverrides: PaddingOverrides = {};

    for (const sep of sepPositions) {
      let posEnPagina: number;
      if (sep.top < PRIMERA_PAGINA) {
        posEnPagina = sep.top % PRIMERA_PAGINA;
      } else {
        const resto = sep.top - PRIMERA_PAGINA;
        posEnPagina = resto % ALTURA_PAGINA_CONT;
      }

      // Si el separador (y la sección siguiente) empieza en los primeros 90px
      // de una página, significa que la página anterior termina con >90px vacíos.
      // Añadimos la mitad de ese espacio como padding para equilibrar.
      if (posEnPagina < 90 && posEnPagina > 0) {
        paddingOverrides[sep.idx] = Math.round(posEnPagina * 0.6);
      }
    }

    // ── Pasada 2 (solo si hay ajustes que aplicar) ──────────────────────
    const hayAjustes = Object.keys(paddingOverrides).length > 0;
    if (hayAjustes) {
      const htmlAjustado = buildPresupuestoHtml(presupuesto, config, logoDataUrl, paddingOverrides);
      await page.setContent(htmlAjustado, { waitUntil: "domcontentloaded", timeout: 30000 });
    }

    const raw = await page.pdf({
      format:          "A4",
      printBackground: true,
      // Los márgenes se controlan desde @page CSS en el HTML
      margin:          { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    pdfBytes = new Uint8Array(raw);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  if (!pdfBytes) {
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500 });
  }

  // ── 5. Devolver PDF ──────────────────────────────────────────────────────
  const numero   = presupuesto.numero ?? "presupuesto";
  const version  = presupuesto.version > 1 ? `-v${presupuesto.version}` : "";
  const filename = `Presupuesto-${numero}${version}.pdf`;

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
