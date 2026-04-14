import { test, expect } from '@playwright/test'

const pages = [
  { name: 'Dashboard', path: '/', wait: 3000 },
  { name: 'Pipelines', path: '/pipelines', wait: 2000 },
  { name: 'Briefing', path: '/briefing', wait: 2000 },
  { name: 'CountryIntel', path: '/country-intel', wait: 2000 },
  { name: 'ObjectExplorer', path: '/objects', wait: 2000 },
  { name: 'Ontology', path: '/ontology', wait: 3000 },
  { name: 'Settings', path: '/settings', wait: 1000 },
]

for (const page of pages) {
  test(`screenshot: ${page.name}`, async ({ page: p, browserName }) => {
    // Suppress console errors in screenshots
    p.on('console', () => {})

    await p.goto(page.path, { waitUntil: 'networkidle', timeout: 30_000 })
    // Wait for content to render
    await p.waitForTimeout(page.wait)
    // Full viewport screenshot
    await p.screenshot({
      path: `screenshots/${page.name}.png`,
      fullPage: false,
    })
  })
}
