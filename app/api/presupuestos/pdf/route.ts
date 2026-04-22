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
import { NextRequest, NextResponse } from "next/server";
import { buildPresupuestoHtml }      from "@/lib/presupuesto-html";
import fs   from "fs";
import path from "path";

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

    // La versión debe coincidir con la del paquete instalado
    const chromiumVersion = "147.0.0";
    const executablePath  = await chromium.executablePath(
      `https://github.com/Sparticuz/chromium/releases/download/v${chromiumVersion}/chromium-v${chromiumVersion}-pack.tar`
    );

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

  // ── 4. Puppeteer: renderizar y generar PDF ───────────────────────────────
  let pdfBytes: Uint8Array | null = null;
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // networkidle0: espera a que Google Fonts se cargue completamente
    await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 30000 });

    const raw = await page.pdf({
      format:          "A4",
      printBackground: true,
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
