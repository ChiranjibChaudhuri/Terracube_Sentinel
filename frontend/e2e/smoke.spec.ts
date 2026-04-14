import { test, expect } from '@playwright/test'

// ─── Smoke tests: every page loads without errors ──────────────────

const pages = [
  { name: 'Dashboard', path: '/' },
  { name: 'Pipelines', path: '/pipelines' },
  { name: 'Briefing', path: '/briefing' },
  { name: 'Country Intel', path: '/country-intel' },
  { name: 'Object Explorer', path: '/objects' },
  { name: 'Ontology', path: '/ontology' },
  { name: 'Settings', path: '/settings' },
]

for (const page of pages) {
  test(`${page.name} page loads`, async ({ page: p }) => {
    const errors: string[] = []
    p.on('pageerror', (err) => errors.push(err.message))
    p.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter known non-fatal: Radix asChild warning, 502 (backend unreachable in dev)
        if (text.includes('asChild') || text.includes('502')) return
        errors.push(`console: ${text}`)
      }
    })

    await p.goto(page.path, { waitUntil: 'networkidle', timeout: 30_000 })
    // Verify we're not on a blank/error page
    await expect(p.locator('body')).toContainText(/terracube|sentinel|dashboard|pipelines|briefing|country|object|ontology|settings/i)
    // No uncaught JS errors (excluding filtered warnings)
    expect(errors).toHaveLength(0)
  })
}

// ─── Sidebar navigation ───────────────────────────────────────────

test('sidebar navigation works', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  // Sidebar should be visible with nav items
  const nav = page.locator('nav, [role="navigation"], aside')
  await expect(nav.first()).toBeVisible()

  // Click Pipelines
  const pipelinesLink = page.getByRole('link', { name: /pipelines/i }).first()
  if (await pipelinesLink.isVisible()) {
    await pipelinesLink.click()
    await page.waitForURL(/\/pipelines/, { timeout: 10_000 })
    await expect(page.locator('body')).toContainText(/pipeline/i)
  }
})

// ─── Dashboard has real content ───────────────────────────────────

test('dashboard renders data widgets', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  // Should have at least one card/table/heading
  const cards = page.locator('[class*="card"], [class*="Card"], table, h1, h2')
  await expect(cards.first()).toBeVisible({ timeout: 10_000 })
})

// ─── API endpoints are reachable ──────────────────────────────────

test('agents health endpoint responds', async ({ request }) => {
  const resp = await request.get('http://localhost:8001/health', { timeout: 15_000 })
  expect(resp.status()).toBe(200)
})

test('agents API root responds', async ({ request }) => {
  const resp = await request.get('http://localhost:8001/', { timeout: 15_000 })
  expect(resp.ok() || resp.status() === 404 || resp.status() === 200).toBeTruthy()
})
