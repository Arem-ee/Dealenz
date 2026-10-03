"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { SignatureMethod } from "@/lib/signatures/validate"

// Signature capture: draw with pointer or type a name rendered in script.
// Emits PNG data URLs the artifact validator accepts. The pad never
// reports a blank canvas as a signature — sign stays disabled until
// strokes land or a typed name renders.
export function SignaturePad({ onChange, disabled }: {
  onChange: (imageData: string | null, method: SignatureMethod) => void
  disabled?: boolean
}) {
  const [mode, setMode] = useState<"drawn" | "typed">("drawn")
  const [typedName, setTypedName] = useState("")
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const strokedRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)

  const emit = useCallback((imageData: string | null, method: SignatureMethod) => {
    onChange(imageData, method)
  }, [onChange])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    strokedRef.current = false
    lastRef.current = null
    emit(null, "drawn")
  }, [emit])

  useEffect(() => {
    if (mode !== "drawn") return
    clearCanvas()
  }, [mode, clearCanvas])

  function pos(e: React.PointerEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function down(e: React.PointerEvent) {
    if (disabled) return
    const p = pos(e)
    if (!p) return
    drawingRef.current = true
    lastRef.current = p
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function move(e: React.PointerEvent) {
    if (!drawingRef.current || disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const p = pos(e)
    if (!canvas || !ctx || !p || !lastRef.current) return
    ctx.strokeStyle = "#1a1a1a"
    ctx.lineWidth = 5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
    if (!strokedRef.current) {
      strokedRef.current = true
    }
  }

  function up() {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    const canvas = canvasRef.current
    if (canvas && strokedRef.current) {
      emit(canvas.toDataURL("image/png"), "drawn")
    }
  }

  function renderTyped(name: string) {
    setTypedName(name)
    if (!name.trim()) {
      emit(null, "typed")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = 960
    canvas.height = 320
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      emit(null, "typed")
      return
    }
    ctx.fillStyle = "#1a1a1a"
    ctx.font = "128px 'Brush Script MT', 'Segoe Script', cursive"
    ctx.textBaseline = "middle"
    const text = name.trim().slice(0, 60)
    const w = ctx.measureText(text).width
    const scale = Math.min(1, (canvas.width - 80) / Math.max(w, 1))
    ctx.save()
    ctx.translate(40, canvas.height / 2)
    ctx.scale(scale, scale)
    ctx.fillText(text, 0, 0)
    ctx.restore()
    emit(canvas.toDataURL("image/png"), "typed")
  }

  return (
    <div>
      <div className="flex gap-1.5" role="tablist" aria-label="Signature style">
        {(["drawn", "typed"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            disabled={disabled}
            onClick={() => setMode(m)}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50",
              mode === m
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "drawn" ? "Draw" : "Type"}
          </button>
        ))}
      </div>

      {mode === "drawn" ? (
        <div className="mt-2">
          <canvas
            ref={canvasRef}
            width={960}
            height={320}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-label="Draw your signature"
            className="h-28 w-full cursor-crosshair touch-none border border-input bg-background disabled:opacity-60"
          />
          <button
            type="button"
            onClick={clearCanvas}
            disabled={disabled}
            className="mt-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <label className="block text-[11px] font-medium text-muted-foreground" htmlFor="typed-signature">
            Type your full name as your signature
          </label>
          <input
            id="typed-signature"
            value={typedName}
            onChange={(e) => renderTyped(e.target.value)}
            disabled={disabled}
            autoComplete="off"
            placeholder="Full legal name"
            className="mt-1 h-10 w-full border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
          {typedName.trim() && (
            <p className="mt-1 font-serif text-2xl text-foreground" aria-hidden="true">{typedName.trim().slice(0, 60)}</p>
          )}
        </div>
      )}
    </div>
  )
}
