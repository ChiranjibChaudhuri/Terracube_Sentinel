import { memo, useEffect, useMemo, useRef } from 'react'
import { Clock, useCesium } from 'resium'
import { ClockRange, ClockStep, JulianDate } from 'cesium'
import type { Clock as CesiumClock } from 'cesium'

interface TimelineViewportProps {
  startTime: JulianDate
  stopTime: JulianDate
}

function TimelineViewport({ startTime, stopTime }: TimelineViewportProps) {
  const { viewer } = useCesium()

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return
    viewer.timeline?.zoomTo(startTime, stopTime)
    viewer.timeline?.resize()
  }, [startTime, stopTime, viewer])

  return null
}

interface CesiumTimelineProps {
  currentTime?: Date
  isPlaying: boolean
  speed: number
  rangeHours?: number
  onTimeChange?: (time: Date) => void
}

function clampDate(date: Date, start: Date, stop: Date) {
  const time = date.getTime()
  return new Date(Math.min(stop.getTime(), Math.max(start.getTime(), time)))
}

function CesiumTimeline({
  currentTime,
  isPlaying,
  speed,
  rangeHours = 48,
  onTimeChange,
}: CesiumTimelineProps) {
  const stopDate = useMemo(() => new Date(), [])
  const startDate = useMemo(
    () => new Date(stopDate.getTime() - rangeHours * 60 * 60 * 1000),
    [rangeHours, stopDate],
  )
  const startTime = useMemo(() => JulianDate.fromDate(startDate), [startDate])
  const stopTime = useMemo(() => JulianDate.fromDate(stopDate), [stopDate])
  const currentJulianTime = useMemo(
    () => JulianDate.fromDate(clampDate(currentTime ?? stopDate, startDate, stopDate)),
    [currentTime, startDate, stopDate],
  )
  const lastEmitRef = useRef(0)

  const handleTick = (clock: CesiumClock) => {
    if (!onTimeChange) return
    const now = performance.now()
    if (now - lastEmitRef.current < 1_000) return
    lastEmitRef.current = now
    onTimeChange(JulianDate.toDate(clock.currentTime))
  }

  return (
    <>
      <Clock
        startTime={startTime}
        stopTime={stopTime}
        currentTime={currentJulianTime}
        clockRange={ClockRange.CLAMPED}
        clockStep={ClockStep.SYSTEM_CLOCK_MULTIPLIER}
        multiplier={speed}
        shouldAnimate={isPlaying}
        onTick={handleTick}
      />
      <TimelineViewport startTime={startTime} stopTime={stopTime} />
    </>
  )
}

export default memo(CesiumTimeline)
