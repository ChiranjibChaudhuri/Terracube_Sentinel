// TerraCube Sentinel — Full screenshot showcase
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5199';
const OUT = '/tmp/sentinel-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };
const PAGES = [
  { name: '01-dashboard', path: '/', wait: 3000, title: 'Dashboard — Situational Awareness' },
  { name: '02-mapview-2d', path: '/', wait: 3000, title: 'Map View — 2D Leaflet', action: 'click3d' },
  { name: '03-mapview-3d', path: '/', wait: 4000, title: 'Map View — 3D Cesium Globe', action: 'switch3d' },
  { name: '04-briefing', path: '/briefing', wait: 2000, title: 'Intelligence Briefing' },
  { name: '05-country-intel', path: '/country-intel', wait: 2000, title: 'Country Intelligence' },
  { name: '06-object-explorer', path: '/object-explorer', wait: 2000, title: 'Foundry Object Explorer' },
  { name: '07-ontology', path: '/ontology', wait: 2000, title: 'Foundry Ontology' },
  { name: '08-pipelines', path: '/pipelines', wait: 2000, title: 'Dagster Pipelines' },
  { name: '09-settings', path: '/settings', wait: 2000, title: 'Settings' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Suppress console noise
  page.on('console', () => {});

  console.log('🎬 Taking screenshots of TerraCube Sentinel...');

  for (const p of PAGES) {
    console.log(`  📸 ${p.name}: ${p.title}`);

    if (p.path !== '/') {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    }

    // Handle map page with 2D/3D toggle
    if (p.action === 'click3d') {
      // Just take screenshot of 2D mode first
    } else if (p.action === 'switch3d') {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      // Wait for map to load
      await page.waitForTimeout(2000);
      // Click the 3D toggle button
      const btn3d = page.locator('button:has-text("3D")').first();
      if (await btn3d.isVisible().catch(() => false)) {
        await btn3d.click();
        await page.waitForTimeout(p.wait);
      } else {
        // Try generic mode toggle
        const modeToggle = page.locator('[data-testid="map-mode-toggle"], button:has-text("3D"), button:has-text("Globe")').first();
        if (await modeToggle.isVisible().catch(() => false)) {
          await modeToggle.click();
          await page.waitForTimeout(p.wait);
        }
      }
    } else {
      await page.waitForTimeout(p.wait);
    }

    await page.screenshot({
      path: path.join(OUT, `${p.name}.png`),
      fullPage: true,
    });

    // Also take a viewport-only shot for the map page (fullPage stretches the map)
    if (p.name.includes('mapview')) {
      await page.screenshot({
        path: path.join(OUT, `${p.name}-viewport.png`),
        fullPage: false,
      });
    }
  }

  await browser.close();
  console.log(`\n✅ Screenshots saved to ${OUT}`);
  console.log(fs.readdirSync(OUT).join('\n'));
})();
