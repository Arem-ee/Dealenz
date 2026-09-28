"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SignatureValue {
  dataUrl: string
  method: "drawn" | "typed" | "uploaded"
}

const PAD_HEIGHT = 160
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

function canvasToDataUrl(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const { width, height } = canvas
  const pixels = ctx.getImageData(0, 0, width, height).data
  for (let i = 3; i < pixels.length; i += 4) {
    if ((pixels[i] ?? 0) > 0) return canvas.toDataURL("image/png")
  }
  return null
}

function renderTypedSignature(name: string, width: number): string {
  const canvas = document.createElement("canvas")
  const scale = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1
  canvas.width = Math.max(1, Math.floor(width * scale))
  canvas.height = Math.floor(PAD_HEIGHT * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  ctx.scale(scale, scale)
  ctx.fillStyle = "#1c1917"
  ctx.font = `italic 44px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`
  ctx.textBaseline = "middle"
  ctx.fillText(name.trim().slice(0, 60), 16, PAD_HEIGHT / 2, Math.max(1, width - 32))
  return canvas.toDataURL("image/png")
}

/**
 * Tablet-style signature capture: draw with mouse/finger or type a name for
 * script rendering. Emits a PNG data URL (or null when blank) on every
 * change. No dependencies, touch-safe via pointer events + touch-action none.
 */
export function SignaturePad({
  name,
  onChange,
}: {
  name: string
  onChange: (value: SignatureValue | null) => void
}) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const emitDrawn = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      onChangeRef.current(null)
      return
    }
    const dataUrl = canvasToDataUrl(canvas)
    onChangeRef.current(dataUrl ? { dataUrl, method: "drawn" } : null)
  }, [])

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.parentElement.clientWidth
    canvas.width = Math.max(1, Math.floor(width * scale))
    canvas.height = Math.floor(PAD_HEIGHT * scale)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(scale, scale)
      ctx.lineWidth = 2.2
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = "#1c1917"
    }
  }, [])

  useEffect(() => {
    if (tab !== "draw") return
    sizeCanvas()
    const onResize = () => {
      // Resize clears strokes; report blank so callers never hold a stale image.
      sizeCanvas()
      onChangeRef.current(null)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [tab, sizeCanvas])

  // Typed tab renders live from the name field owned by the parent form.
  useEffect(() => {
    if (tab !== "type") return
    if (!name.trim()) {
      onChangeRef.current(null)
      return
    }
    const width = canvasRef.current?.parentElement?.clientWidth ?? 320
    const dataUrl = renderTypedSignature(name, width)
    onChangeRef.current(dataUrl ? { dataUrl, method: "typed" } : null)
  }, [tab, name])

  // Uploaded scans/photos are re-encoded as PNG through a canvas so storage
  // sees exactly one format (the validator pins PNG); oversized images are
  // downscaled to fit before encoding.
  async function handleUpload(file: File | undefined) {
    setUploadError(null)
    if (!file) return
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Use a PNG or JPG image.")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("That image is too large (3 MB max).")
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      const maxWidth = 600
      const scale = Math.min(1, maxWidth / bitmap.width)
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale))
      canvas.height = Math.max(1, Math.floor(bitmap.height * scale))
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no 2d context")
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const dataUrl = canvas.toDataURL("image/png")
      setUploadPreview(dataUrl)
      onChangeRef.current({ dataUrl, method: "uploaded" })
    } catch {
      setUploadError("Could not read that image — try another file.")
    }
  }

  const point = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    onChangeRef.current(null)
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg bg-muted/60 p-1" role="tablist" aria-label="Signature style">
        {(["draw", "type", "upload"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => {
              setTab(t)
              setUploadError(null)
              if (t !== "upload") setUploadPreview(null)
              onChangeRef.current(null)
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "draw" ? "Draw it" : t === "type" ? "Type it" : "Upload it"}
          </button>
        ))}
      </div>
      {tab === "draw" ? (
        <div className="relative mt-2">
          <canvas
            ref={canvasRef}
            style={{ height: PAD_HEIGHT, touchAction: "none" }}
            className="w-full cursor-crosshair rounded-lg border border-dashed border-border bg-card"
            aria-label="Draw your signature here"
            onPointerDown={(e) => {
              drawing.current = true
              last.current = point(e)
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return
              const canvas = canvasRef.current
              const ctx = canvas?.getContext("2d")
              const p = point(e)
              if (!canvas || !ctx || !p) return
              const scale = Math.min(window.devicePixelRatio || 1, 2)
              ctx.save()
              ctx.scale(1 / scale, 1 / scale)
              ctx.beginPath()
              const from = last.current ?? p
              ctx.moveTo(from.x * scale, from.y * scale)
              ctx.lineTo(p.x * scale, p.y * scale)
              ctx.stroke()
              ctx.restore()
              last.current = p
            }}
            onPointerUp={() => {
              drawing.current = false
              last.current = null
              emitDrawn()
            }}
            onPointerCancel={() => {
              drawing.current = false
              last.current = null
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="absolute right-2 top-2 h-8 gap-1 text-xs">
            <Eraser className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      ) : tab === "type" ? (
        <div className="mt-2 rounded-lg border border-dashed border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Rendered from the name above in script style.</p>
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-dashed border-border bg-card px-4 py-3">
          <label className="block text-[11px] text-muted-foreground">
            A photo or scan of your handwritten signature (PNG or JPG, 3 MB max).
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="mt-2 block w-full text-xs"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
          </label>
          {uploadError && <p className="mt-2 text-xs text-destructive" role="alert">{uploadError}</p>}
          {uploadPreview && !uploadError && (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL preview, not an optimizable asset
            <img src={uploadPreview} alt="Uploaded signature preview" className="mt-2 h-16 w-auto rounded border border-border/60 bg-white px-2" />
          )}
        </div>
      )}
    </div>
  )
}
