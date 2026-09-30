"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { feature } from "topojson-client"

type LonLat = [number, number]

interface EcoNode {
  label: string
  lon: number
  lat: number
}

const NODES: EcoNode[] = [
  { label: "Gmail intake", lon: -73.9, lat: 40.7 },
  { label: "Signing", lon: 4.9, lat: 52.4 },
  { label: "Monitoring", lon: -122, lat: 37 },
  { label: "Billing", lon: -0.1, lat: 51.5 },
]

const DOT_COUNT = 1500
const TILT = (23.4 * Math.PI) / 180
const BASE_SPIN = 0.0028

function inRing(lon: number, lat: number, ring: LonLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]
    const yi = ring[i]![1]
    const xj = ring[j]![0]
    const yj = ring[j]![1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function isLand(lon: number, lat: number, polygons: LonLat[][][]): boolean {
  for (const poly of polygons) {
    const exterior = poly[0]
    if (!exterior || !inRing(lon, lat, exterior)) continue
    let hole = false
    for (let k = 1; k < poly.length; k++) {
      if (inRing(lon, lat, poly[k]!)) {
        hole = true
        break
      }
    }
    if (!hole) return true
  }
  return false
}

interface Dot {
  lon: number
  lat: number
  land: boolean
}

function fibonacciDots(count: number): Array<{ lon: number; lat: number }> {
  const pts: Array<{ lon: number; lat: number }> = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    pts.push({
      lon: (Math.atan2(z, x) * 180) / Math.PI,
      lat: (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI,
    })
  }
  return pts
}

export function EarthGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvasEl = canvasRef.current
    const wrapEl = wrapRef.current
    if (!canvasEl || !wrapEl) return
    const canvas: HTMLCanvasElement = canvasEl
    const wrap: HTMLDivElement = wrapEl
    const maybeCtx = canvas.getContext("2d")
    if (!maybeCtx) return
    const ctx: CanvasRenderingContext2D = maybeCtx

    let disposed = false
    let dots: Dot[] = fibonacciDots(DOT_COUNT).map((d) => ({ ...d, land: false }))
    let mapsReady = false
    const rot = { lon: -30, vel: 0 }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const controller = new AbortController()
    fetch("/land-110m.json", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((topology) => {
        if (disposed || !topology) return
        try {
          const converted = feature(topology, topology.objects.land) as unknown as
            | { type: "Feature"; geometry: { type: string; coordinates: unknown } }
            | { type: "FeatureCollection"; features: Array<{ geometry: { type: string; coordinates: unknown } }> }
          const geometries =
            converted.type === "FeatureCollection"
              ? converted.features.map((f) => f.geometry)
              : [converted.geometry]
          const polygons: LonLat[][][] = []
          for (const g of geometries) {
            if (g.type === "MultiPolygon") polygons.push(...(g.coordinates as LonLat[][][]))
            else if (g.type === "Polygon") polygons.push(g.coordinates as LonLat[][])
          }
          if (polygons.length === 0) return
          dots = dots.map((d) => ({ ...d, land: isLand(d.lon, d.lat, polygons) }))
        } catch {
          // Land classification failed: render the abstract sphere instead
          // of nothing. Nodes still pin to their coordinates.
        }
        mapsReady = true
      })
      .catch(() => {
        // Offline or missing asset: abstract sphere fallback.
      })

    function project(lon: number, lat: number, radius: number, cx: number, cy: number) {
      const lambda = ((lon + rot.lon) * Math.PI) / 180
      const phi = (lat * Math.PI) / 180
      const x = Math.cos(phi) * Math.sin(lambda)
      const y0 = Math.sin(phi)
      const z0 = Math.cos(phi) * Math.cos(lambda)
      const y = y0 * Math.cos(TILT) - z0 * Math.sin(TILT)
      const z = y0 * Math.sin(TILT) + z0 * Math.cos(TILT)
      return { x: cx + x * radius, y: cy - y * radius, z }
    }

    function sizeCanvas() {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const side = Math.max(300, Math.min(rect.width, 600))
      canvas.width = Math.floor(side * dpr)
      canvas.height = Math.floor(side * dpr)
      canvas.style.width = `${side}px`
      canvas.style.height = `${side}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return side
    }

    let side = sizeCanvas()
    const ro = new ResizeObserver(() => {
      side = sizeCanvas()
      if (reduced) draw(0)
    })
    ro.observe(wrap)

    function draw(time: number) {
      const radius = side * 0.42
      const cx = side / 2
      const cy = side / 2
      // Fixed key light from the upper left sculpts the spherical volume.
      const lx = -0.55
      const ly = -0.65
      const lz = 0.52
      ctx.clearRect(0, 0, side, side)

      // Cast shadow: stacked flat ellipses falling lower-left, like the
      // study's ground shadow. Drawn first so the sphere sits on it.
      const shX = cx - radius * 0.55
      const shY = cy + radius * 1.04
      const shW = radius * 1.5
      for (const [wScale, alpha] of [[1, 0.05], [0.8, 0.05], [0.6, 0.06]] as const) {
        ctx.beginPath()
        ctx.ellipse(shX, shY, (shW * wScale) / 2, radius * 0.09, -0.06, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(10,11,13,${alpha})`
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(10,11,13,0.28)"
      ctx.lineWidth = 1
      ctx.stroke()

      for (const d of dots) {
        const p = project(d.lon, d.lat, radius, cx, cy)
        if (p.z < -0.08) continue
        const depth = Math.max(0, Math.min(1, (p.z + 0.08) / 1.08))
        // Diffuse term from the dot's rotated surface normal.
        const lambda = ((d.lon + rot.lon) * Math.PI) / 180
        const phi = (d.lat * Math.PI) / 180
        const nx = Math.cos(phi) * Math.sin(lambda)
        const ny0 = Math.sin(phi)
        const nz0 = Math.cos(phi) * Math.cos(lambda)
        const ny = ny0 * Math.cos(TILT) - nz0 * Math.sin(TILT)
        const nz = ny0 * Math.sin(TILT) + nz0 * Math.cos(TILT)
        const diffuse = Math.max(0, nx * lx + -ny * ly + nz * lz)
        // Pencil-study ramp: eased highlight, deep terminator, faint
        // reflected lift just past the dark edge so the limb stays round.
        const eased = Math.pow(Math.max(0, Math.min(1, diffuse)), 1.35)
        const bounce = Math.max(0, 1 - Math.abs(p.z + 0.38) * 3.2) * 0.14
        // Rim light kisses the limb so the disc edge reads round.
        const rim = Math.max(0, 1 - Math.abs(p.z) * 4) * 0.3
        const light = Math.min(1, eased * 0.92 + bounce + rim * (1 - eased))
        const r = (d.land ? 0.8 : 0.6) + depth * (d.land ? 2.6 : 1.5)
        if (d.land) {
          ctx.fillStyle = `rgba(4,120,87,${0.06 + depth * 0.94 * (0.2 + 0.8 * light)})`
        } else {
          ctx.fillStyle = mapsReady
            ? `rgba(10,11,13,${(0.015 + depth * 0.1) * (0.25 + 0.75 * light)})`
            : `rgba(10,11,13,${(0.03 + depth * 0.16) * (0.25 + 0.75 * light)})`
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Soft specular bloom upper-left of the disc, clipped to the sphere.
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.clip()
      const bloom = ctx.createRadialGradient(
        cx - radius * 0.45, cy - radius * 0.5, radius * 0.05,
        cx - radius * 0.45, cy - radius * 0.5, radius * 0.85
      )
      bloom.addColorStop(0, "rgba(255,255,255,0.20)")
      bloom.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = bloom
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
      ctx.restore()

      ctx.font = "600 11px 'Mona Sans Variable', sans-serif"
      for (const n of NODES) {
        const p = project(n.lon, n.lat, radius, cx, cy)
        if (p.z < 0.05) continue
        const phase = ((time / 2200 + n.lon / 360) % 1 + 1) % 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4 + phase * 12, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(5,150,105,${0.5 * (1 - phase)})`
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = "#059669"
        ctx.fill()
        const label = n.label
        const w = ctx.measureText(label).width
        ctx.fillStyle = "rgba(247,246,243,0.85)"
        ctx.fillRect(p.x + 5, p.y - 5, w + 8, 15)
        ctx.fillStyle = "rgba(28,25,23,0.9)"
        ctx.fillText(label, p.x + 9, p.y + 6)
      }
    }

    if (reduced) {
      draw(0)
      return () => {
        disposed = true
        controller.abort()
        ro.disconnect()
      }
    }

    gsap.from(wrap, { opacity: 0, scale: 0.97, duration: 0.9, ease: "power2.out" });

    const onTick = () => {
      rot.lon += BASE_SPIN * 60 * 0.016 + rot.vel
      rot.vel *= 0.95
      draw(gsap.ticker.time * 1000)
    }
    gsap.ticker.add(onTick)

    let dragging = false
    let lastX = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = "grabbing"
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      rot.lon += dx * 0.25
      rot.vel = dx * 0.02
    }
    const onUp = () => {
      dragging = false
      canvas.style.cursor = "grab"
    }
    canvas.style.cursor = "grab"
    canvas.style.touchAction = "pan-y"
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onUp)

    return () => {
      disposed = true
      controller.abort()
      gsap.ticker.remove(onTick)
      ro.disconnect()
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
    }
  }, [])

  return (
    <div ref={wrapRef} className="flex items-center justify-center">
      <canvas ref={canvasRef} role="img" aria-label="Rotating globe showing worldwide integration coverage" />
    </div>
  )
}
