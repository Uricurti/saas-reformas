import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:3000';

async function shot(page, name, selector) {
  const el = selector ? page.locator(selector).first() : null;
  const target = el ? await el.elementHandle() : null;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: target ? undefined : { x: 0, y: 0, width: 1280, height: 800 },
    fullPage: false,
  });
  console.log(`✓ ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // ── LOGIN ──────────────────────────────────────────────────────
  console.log('Logging in...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill email
  await page.fill('#email', 'admin@reformasapp.com');

  // Fill password
  await page.fill('#password', '123456');

  // Submit
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log('Logged in. Current URL:', page.url());

  // ── DASHBOARD ─────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await shot(page, 'dashboard');

  // Mobile version of dashboard
  await ctx.close();
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const mPage = await mCtx.newPage();

  // Re-login on mobile
  await mPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(1000);
  await mPage.fill('#email', 'admin@reformasapp.com');
  await mPage.fill('#password', '123456');
  await mPage.click('button[type="submit"]');
  await mPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await mPage.waitForTimeout(2000);

  // ── MOBILE SCREENSHOTS ────────────────────────────────────────
  const mRoutes = [
    ['dashboard',      '/dashboard'],
    ['obras',          '/obras'],
    ['calendario',     '/calendario'],
    ['jornales',       '/jornales'],
    ['facturacion',    '/facturacion'],
  ];

  for (const [name, route] of mRoutes) {
    await mPage.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(2500);
    await mPage.screenshot({
      path: path.join(OUT, `mobile_${name}.png`),
      fullPage: false,
    });
    console.log(`✓ mobile_${name}.png`);
  }

  // Also try to open first obra detail
  try {
    await mPage.goto(`${BASE}/obras`, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(1500);
    const obraLink = mPage.locator('a[href*="/obras/"]').first();
    const href = await obraLink.getAttribute('href').catch(() => null);
    if (href) {
      await mPage.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await mPage.waitForTimeout(2500);
      await mPage.screenshot({ path: path.join(OUT, 'mobile_obra_detail.png'), fullPage: false });
      console.log('✓ mobile_obra_detail.png');

      // Try fotos tab
      const fotosTab = mPage.locator('a:has-text("Fotos"), button:has-text("Fotos"), [href*="fotos"]').first();
      if (await fotosTab.count()) {
        await fotosTab.click();
        await mPage.waitForTimeout(2000);
        await mPage.screenshot({ path: path.join(OUT, 'mobile_fotos.png'), fullPage: false });
        console.log('✓ mobile_fotos.png');
      }
    }
  } catch (e) {
    console.log('Could not capture obra detail:', e.message);
  }

  await mCtx.close();
  await browser.close();
  console.log('\nDone! Screenshots saved to:', OUT);
})();
