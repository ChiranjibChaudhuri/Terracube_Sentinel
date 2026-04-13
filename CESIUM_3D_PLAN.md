# 3D Globe Visualization — Cesium + Deck.gl Integration Plan

## Goal

Replace the current 2D Leaflet map + hand-rolled Canvas2D globe with a proper **Cesium 3D globe** (via resium) that renders:
- Moving satellite orbits (4D time-animated)
- Live aircraft tracks with altitude
- Live vessel tracks at sea level
- Hazard event zones
- 4D timeline playback (scrub through time)

Keep the existing 2D Leaflet mode as a lightweight fallback option.

---

## Tech Decision: Cesium (resium) over Deck.gl

**Why Cesium + resium (React Cesium):**
- True 3D globe with photorealistic imagery (Bing Maps, Mapbox, custom tiles)
- Native terrain (Cesium World Terrain)
- CZML for time-dynamic entity visualization (satellite orbits, moving tracks)
- 3D entity rendering at correct altitude (FL350 aircraft, sea-level vessels, LEO satellites)
- Built-in timeline widget for 4D playback
- Widely used in defense/intelligence dashboards (Palantir-style)

**Why NOT Deck.gl:**
- Globe mode is relatively new and less mature
- No native satellite orbit support
- 2.5D only (no true 3D terrain perspective)
- No built-in timeline/animation system

---

## Phase 1: Install & Scaffold (5 files)

### Dependencies
```bash
npm install cesium resium
npm install -D @types/cesium vite-plugin-cesium
```

### Files to create/modify
1. `frontend/vite.config.ts` — add cesium plugin (copy Cesium assets)
2. `frontend/src/components/CesiumGlobe.tsx` — main 3D globe component
3. `frontend/src/lib/cesium-entities.ts` — convert Aircraft/Vessel/Satellite/Hazard → Cesium entities
4. `frontend/src/components/CesiumTimeline.tsx` — timeline playback control (wraps Cesium Clock)
5. `frontend/src/pages/MapView.tsx` — integrate CesiumGlobe into 3D mode toggle

---

## Phase 2: CesiumGlobe Component

### `frontend/src/components/CesiumGlobe.tsx`

```tsx
// Props: awareness data (aircraft, vessels, satellites, hazards, gseRegions)
//       + timeRange for timeline
// Uses: <Viewer>, <Entity>, <PointGraphics>, <PathGraphics>, <PolygonGraphics>
//       <Clock>, <Timeline> from resium
```

**Viewer config:**
- Dark theme (dark globe + dark UI)
- Bing Maps aerial imagery with dark atmosphere
- Cesium World Terrain ON
- Camera: start at globe view, home button to reset
- Credit container hidden (cleaner look)

### Entity Rendering

| Data Type | Cesium Primitive | Altitude | Visual |
|-----------|-----------------|----------|--------|
| **Aircraft** | `Entity` + `PointGraphics` + `PathGraphics` | Clamped to altitude (meters MSL) | Cyan dot + fading trail (last 10 positions) |
| **Vessel** | `Entity` + `PointGraphics` + `PathGraphics` | 0 (sea level, `HeightReference.CLAMP_TO_GROUND`) | Blue dot + short trail |
| **Satellite** | `Entity` + `PathGraphics` (sampled orbit) | Calculated from TLE / CelesTrak data | Green orbit arc + satellite icon |
| **Hazards** | `Entity` + `EllipseGraphics` or `PolygonGraphics` | Ground-clamped | Semi-transparent colored zone |
| **GSE Zones** | `Entity` + `EllipseGraphics` | Ground-clamped | Dashed border + colored fill by threat level |

---

## Phase 3: Entity Conversion Layer

### `frontend/src/lib/cesium-entities.ts`

Convert existing TypeScript types to Cesium entity descriptors:

```ts
// Aircraft → Cesium entity with:
//   - Position: Cartesian3 from lat/lng/alt
//   - Point: cyan pixel, scale by altitude
//   - Path: last N positions as polyline trail
//   - Label: callsign
//   - Orientation: billboard/point aligned to heading

// Vessel → Cesium entity with:
//   - Position: lat/lng at ground level
//   - Point: blue pixel, scale by speed
//   - Path: short trail (last 5 positions)
//   - Label: vessel name
//   - Color by shipType (TANKER=orange, CARGO=blue, FISHING=green, MILITARY=red)

// Satellite → Cesium entity with:
//   - Position: computed orbit path (great circle from 2+ observations, or TLE if available)
//   - Path: full orbit arc (semi-transparent)
//   - Point: white/green dot at current position
//   - Label: satellite name + NORAD ID

// Hazard → Cesium entity with:
//   - Ellipse at lat/lng with radius by severity
//   - Material: semi-transparent color by severity
//   - Height: ground-clamped

// GSE Region → Cesium entity with:
//   - Ellipse centered on region coords
//   - Dashed outline
//   - Fill color by threat level
```

---

## Phase 4: 4D Timeline

### `frontend/src/components/CesiumTimeline.tsx`

- Wrap Cesium's built-in `Clock` and `Timeline` components
- Configure: start = 48h ago, stop = now, multiplier = 60x real-time
- Expose `onTimeChange` callback to parent (triggers data refetch for historical data)
- Connect to existing `TimelineControls` component as alternative UI
- Playback modes: play/pause, speed control (1x/10x/60x/300x)
- Visual scrubber synced with Cesium timeline

### Integration with useAwarenessData
- When timeline is NOT playing → show live data (current behavior)
- When timeline IS playing → fetch historical data for the selected time window
- Pass `hoursAgo` parameter to `getFusionAwareness()` API call
- Backend already supports time-range filtering via the fusion cache

---

## Phase 5: Satellite Orbit Visualization

### Source: CelesTrak adapter (already exists)
- `dagster/sources/celestrak_adapter.py` fetches satellite positions
- Normalize TLE → Cesium `SampledPositionProperty` (orbit path)

### Implementation
- For each satellite, compute ~90-minute orbit path from 2+ position samples
- Render as `PathGraphics` with `leadTime`/`trailTime` showing full orbit
- Differentiate by orbit type: LEO (green), MEO (yellow), GEO (orange)
- Add orbit inclination tilt in 3D
- Show satellite footprint cone (ground area visible from satellite)

---

## Phase 6: Performance & Polish

### Performance
- **Entity pooling**: reuse entity objects instead of recreating on every data refresh
- **LOD (Level of Detail)**: simplify entity rendering at zoom levels
- **Point primitive collection**: for 1000+ vessels/aircraft, use `PointPrimitiveCollection` instead of individual entities
- **Throttle updates**: 30s refresh (already in useAwarenessData), batch entity updates
- **Web Workers**: offload orbit calculations to worker thread

### Polish
- Camera fly-to on entity click (smooth animation)
- Entity selection highlighting (glow effect)
- Info panel overlay (reuses existing `EntityDetail` component)
- Layer toggle (reuse existing `LayerPanel` component)
- Loading indicator (satellite imagery tiles)
- Dark globe with dark atmosphere scatter
- Star field background (Cesium built-in)
- Sun lighting (day/night terminator on globe)

---

## Phase 7: Optional Enhancements

- **Heatmap layer**: vessel density heatmap in shipping lanes
- **Geofencing**: draw custom zones, alert when vessels/aircraft enter
- **Track interpolation**: smooth aircraft/vessel paths between position updates
- **3D terrain**: emphasize hazard zones on terrain (flood extent on DEM)
- **Split view**: 2D Leaflet + 3D Cesium side-by-side
- **Screenshot/export**: capture current view as image
- **KML/CZML export**: export entity data for external tools

---

## File Structure

```
frontend/src/
├── components/
│   ├── CesiumGlobe.tsx          # Main 3D globe (NEW)
│   ├── CesiumTimeline.tsx       # Timeline playback (NEW)
│   ├── CesiumLayerPanel.tsx     # Layer toggles for 3D (NEW)
│   └── ...existing components
├── lib/
│   ├── cesium-entities.ts       # Type → Cesium entity converters (NEW)
│   ├── cesium-config.ts         # Viewer defaults, colors, scales (NEW)
│   └── ...existing lib files
├── pages/
│   └── MapView.tsx              # Modified: integrate CesiumGlobe in 3D mode
├── hooks/
│   └── useAwarenessData.ts      # Modified: add timeRange param for historical
└── index.css                    # Modified: import Cesium CSS
```

---

## API Changes (Minimal)

The backend already supports time-range queries via the fusion cache. Only needed:

1. `getFusionAwareness()` — add optional `hoursAgo` param (already partially supported)
2. Satellite orbit data — CelesTrak adapter already provides positions; TLE orbit calculation can be done client-side

---

## Effort Estimate

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| Phase 1 | Install + scaffold | None |
| Phase 2 | CesiumGlobe + basic entities | Phase 1 |
| Phase 3 | Entity conversion layer | Phase 2 |
| Phase 4 | 4D Timeline | Phase 2 |
| Phase 5 | Satellite orbits | Phase 3 |
| Phase 6 | Performance + polish | Phase 3-5 |
| Phase 7 | Optional enhancements | Phase 6 |

**Codex should implement Phases 1-4 in a single session.** Phases 5-7 can follow.
