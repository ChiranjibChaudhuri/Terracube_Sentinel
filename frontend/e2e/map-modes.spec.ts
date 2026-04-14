import { test, expect } from '@playwright/test'

test('screenshot: MapView 2D mode', async ({ page: p }) => {
  p.on('console', () => {})
  await p.goto('/map', { waitUntil: 'networkidle', timeout: 30_000 })
  await p.waitForTimeout(4000) // Wait for 2D map to fully render
  await p.screenshot({
    path: 'screenshots/MapView-2D.png',
    fullPage: false,
  })
})

test('screenshot: MapView 3D mode', async ({ page: p }) => {
  p.on('console', () => {})
  await p.goto('/map', { waitUntil: 'networkidle', timeout: 30_000 })
  await p.waitForTimeout(3000)

  // Click the 3D Globe button
  await p.locator('button:has-text("3D Globe")').click()

  // Wait for Cesium to load
  await p.waitForTimeout(6000)

  await p.screenshot({
    path: 'screenshots/MapView-3D.png',
    fullPage: false,
  })
})
