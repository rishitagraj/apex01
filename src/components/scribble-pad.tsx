'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Trash2 } from 'lucide-react'

const COLORS = ['#1f1f28', '#e03560', '#2563eb', '#16a34a']

type Point = { x: number; y: number }

export function ScribblePad({ onChange }: { onChange: (image: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState(COLORS[0])
  const [erasing, setErasing] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const drawingRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const colorRef = useRef(color)
  const erasingRef = useRef(erasing)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  useEffect(() => {
    colorRef.current = color
  }, [color])

  useEffect(() => {
    erasingRef.current = erasing
  }, [erasing])

  const setup = useCallback((width: number) => {
    const canvas = canvasRef.current!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(Math.floor(width), 200)
    const h = Math.round(Math.min(w * 0.6, 360))
    sizeRef.current = { w, h, dpr }
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    const container = containerRef.current!
    const canvas = canvasRef.current!
    setup(container.clientWidth)

    let snapshot: HTMLCanvasElement | null = null
    const ro = new ResizeObserver(() => {
      const target = Math.max(Math.floor(container.clientWidth), 200)
      const { w } = sizeRef.current
      if (Math.abs(target - w) < 4 || canvas.width === 0) return
      snapshot = document.createElement('canvas')
      snapshot.width = canvas.width
      snapshot.height = canvas.height
      snapshot.getContext('2d')!.drawImage(canvas, 0, 0)
      setup(target)
      const ctx = canvas.getContext('2d')!
      const { w: nw, h: nh } = sizeRef.current
      if (snapshot) ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, nw, nh)
      const out = document.createElement('canvas')
      out.width = nw
      out.height = nh
      out.getContext('2d')!.drawImage(canvas, 0, 0, nw, nh)
      onChange(out.toDataURL('image/png'))
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [setup, onChange])

  function toPoint(e: React.PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function drawLine(from: Point, to: Point) {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = erasingRef.current ? '#ffffff' : colorRef.current
    ctx.lineWidth = erasingRef.current ? 18 : 3
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  function drawDot(p: Point) {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.fillStyle = erasingRef.current ? '#ffffff' : colorRef.current
    ctx.beginPath()
    ctx.arc(p.x, p.y, erasingRef.current ? 9 : 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current!
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const p = toPoint(e)
    lastRef.current = p
    drawDot(p)
    setHasInk(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const p = toPoint(e)
    if (lastRef.current) drawLine(lastRef.current, p)
    lastRef.current = p
  }

  function onPointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    emit()
  }

  function emit() {
    const canvas = canvasRef.current!
    const { w, h } = sizeRef.current
    if (!w || !h) return
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d')!.drawImage(canvas, 0, 0, w, h)
    onChange(out.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current!
    const { w, h, dpr } = sizeRef.current
    if (!w || !h) return
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="overflow-hidden rounded-xl border border-line">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block cursor-crosshair touch-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Pen color ${c}`}
            onClick={() => {
              setColor(c)
              setErasing(false)
            }}
            className={`h-6 w-6 rounded-full border transition ${
              color === c && !erasing ? 'ring-2 ring-apex' : 'border-line'
            }`}
            style={{ background: c }}
          />
        ))}
        <button
          type="button"
          onClick={() => setErasing((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
            erasing
              ? 'border-apex/50 bg-apex/10 text-apex'
              : 'border-line text-muted hover:text-foreground'
          }`}
        >
          <Eraser size={13} /> Eraser
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:text-rose-400 disabled:opacity-40"
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>
    </div>
  )
}