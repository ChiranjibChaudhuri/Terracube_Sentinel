import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useImperativeHandle, useState } from 'react'
import {
  CameraFlyTo,
  EllipseGraphics,
  Entity,
  Fog,
  Globe as ResiumGlobe,
  LabelGraphics,
  PathGraphics,
  PointGraphics,
  PolylineGraphics,
  Scene,
  SkyAtmosphere,
  Viewer,
  Camera,
} from 'resium'
import { Cartesian3, Color, Terrain } from 'cesium'
import type { GseRegionSummaryResponse } from '../lib/api'
import type { Aircraft, HazardEvent, SatellitePass, Vessel } from '../lib/types'
import {
  aircraftToCesiumEntity,
  gseRegionToCesiumEntity,
  hazardToCesiumEntity,
  satelliteToCesiumEntity,
  vesselToCesiumEntity,
  type CesiumEntityDescriptor,
} from '../lib/cesium-entities'
import CesiumTimeline from './CesiumTimeline'

export type CesiumLayerVisibility = Partial<Record<'hazards' | 'aircraft' | 'vessels' | 'satellites' | 'gse', boolean>>

const SPACE_COLOR = Color.fromCssColorString('#020617')
const GLOBE_BASE_COLOR = Color.fromCssColorString('#0f172a')
const INITIAL_CAMERA_DESTINATION = Cartesian3.fromDegrees(18, 18, 23_000_000)
const INITIAL_CAMERA_ORIENTATION = {
  heading: 0,
  pitch: -Math.PI / 2,
  roll: 0,
}

interface CesiumGlobeProps {
  aircraft: Aircraft[]
  vessels: Vessel[]
  satellites: SatellitePass[]
  hazards: HazardEvent[]
  gseRegions: GseRegionSummaryResponse[]
  layerVisibility?: CesiumLayerVisibility
  currentTime?: Date
  isPlaying?: boolean
  speed?: number
  onEntityClick?: (entity: Record<string, unknown>) => void
  onTimeChange?: (time: Date) => void
}

export interface CesiumGlobeRef {
  flyTo: (lon: number, lat: number, alt?: number, duration?: number) => void
}

function isLayerVisible(layerVisibility: CesiumLayerVisibility | undefined, id: keyof Required<CesiumLayerVisibility>) {
  return layerVisibility?.[id] ?? true
}

interface CesiumEntityFeatureProps {
  descriptor: CesiumEntityDescriptor
  showLabel: boolean
  onSelect: (descriptor: CesiumEntityDescriptor) => void
  onHover: (id: string | null) => void
}

const CesiumEntityFeature = memo(function CesiumEntityFeature({
  descriptor,
  showLabel,
  onSelect,
  onHover,
}: CesiumEntityFeatureProps) {
  return (
    <Entity
      id={descriptor.id}
      name={descriptor.name}
      position={descriptor.position}
      orientation={descriptor.orientation}
      description={descriptor.description}
      onClick={() => onSelect(descriptor)}
      onMouseEnter={() => onHover(descriptor.id)}
      onMouseLeave={() => onHover(null)}
    >
      {descriptor.point && <PointGraphics {...descriptor.point} />}
      {descriptor.path && <PathGraphics {...descriptor.path} />}
      {descriptor.ellipse && <EllipseGraphics {...descriptor.ellipse} />}
      {descriptor.polyline && <PolylineGraphics {...descriptor.polyline} />}
      <LabelGraphics {...descriptor.label} show={showLabel} />
    </Entity>
  )
})

const CesiumGlobe = forwardRef<CesiumGlobeRef, CesiumGlobeProps>(({
  aircraft,
  vessels,
  satellites,
  hazards,
  gseRegions,
  layerVisibility,
  currentTime,
  isPlaying = false,
  speed = 60,
  onEntityClick,
  onTimeChange,
}, ref) => {
  const cameraRef = useRef<any>(null)
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const terrain = useMemo(() => Terrain.fromWorldTerrain(), [])
  const creditContainer = useMemo(() => document.createElement('div'), [])

  // Expose flyTo method via imperative handle
  useImperativeHandle(ref, () => ({
    flyTo: (lon: number, lat: number, alt = 500000, duration = 2) => {
      const destination = Cartesian3.fromDegrees(lon, lat, alt)
      if (cameraRef.current) {
        cameraRef.current.flyTo(destination, {
          duration,
          maximumHeight: alt * 2,
          orientation: {
            heading: 0,
            pitch: -Math.PI / 2,
            roll: 0,
          },
        })
      }
    },
  }), [])

  const entities = useMemo(() => {
    const nextEntities: CesiumEntityDescriptor[] = []

    if (isLayerVisible(layerVisibility, 'aircraft')) {
      for (const entity of aircraft) {
        const descriptor = aircraftToCesiumEntity(entity)
        if (descriptor) nextEntities.push(descriptor)
      }
    }

    if (isLayerVisible(layerVisibility, 'vessels')) {
      for (const entity of vessels) {
        const descriptor = vesselToCesiumEntity(entity)
        if (descriptor) nextEntities.push(descriptor)
      }
    }

    if (isLayerVisible(layerVisibility, 'satellites')) {
      for (const entity of satellites) {
        const descriptor = satelliteToCesiumEntity(entity)
        if (descriptor) nextEntities.push(descriptor)
      }
    }

    if (isLayerVisible(layerVisibility, 'hazards')) {
      for (const entity of hazards) {
        const descriptor = hazardToCesiumEntity(entity)
        if (descriptor) nextEntities.push(descriptor)
      }
    }

    if (isLayerVisible(layerVisibility, 'gse')) {
      for (const entity of gseRegions) {
        const descriptor = gseRegionToCesiumEntity(entity)
        if (descriptor) nextEntities.push(descriptor)
      }
    }

    return nextEntities
  }, [aircraft, gseRegions, hazards, layerVisibility, satellites, vessels])

  const activeSelectedEntityId = entities.some((entity) => entity.id === selectedEntityId)
    ? selectedEntityId
    : null

  const handleSelect = useCallback((descriptor: CesiumEntityDescriptor) => {
    setSelectedEntityId(descriptor.id)
    onEntityClick?.(descriptor.detail)
  }, [onEntityClick])

  return (
    <div className="cesium-globe-shell h-full w-full bg-[#020617]">
      <Viewer
        full
        className="cesium-globe-viewer"
        animation={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        geocoder={false}
        homeButton
        infoBox={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        selectionIndicator={false}
        timeline
        terrain={terrain}
        creditContainer={creditContainer}
      >
        <Scene backgroundColor={SPACE_COLOR} />
        <Fog enabled density={0.00018} />
        <SkyAtmosphere
          hueShift={-0.08}
          saturationShift={-0.32}
          brightnessShift={-0.18}
        />
        <ResiumGlobe
          baseColor={GLOBE_BASE_COLOR}
          enableLighting
          dynamicAtmosphereLighting
          showGroundAtmosphere
          atmosphereLightIntensity={3.2}
          depthTestAgainstTerrain={false}
        />
        <CameraFlyTo
          destination={INITIAL_CAMERA_DESTINATION}
          orientation={INITIAL_CAMERA_ORIENTATION}
          duration={0}
          once
        />
        <Camera ref={cameraRef} />
        <CesiumTimeline
          currentTime={currentTime}
          isPlaying={isPlaying}
          speed={speed}
          onTimeChange={onTimeChange}
        />
        {entities.map((descriptor) => (
          <CesiumEntityFeature
            key={descriptor.id}
            descriptor={descriptor}
            showLabel={hoveredEntityId === descriptor.id || activeSelectedEntityId === descriptor.id}
            onSelect={handleSelect}
            onHover={setHoveredEntityId}
          />
        ))}
      </Viewer>
    </div>
  )
})

CesiumGlobe.displayName = 'CesiumGlobe'

export default memo(CesiumGlobe)
