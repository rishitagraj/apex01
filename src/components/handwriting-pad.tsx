"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ScanText, Trash2, Loader2, AlertCircle } from "lucide-react";
import type { InferenceSession } from "onnxruntime-web";

const MODEL_URL = "/text-reader/model_int8.onnx";
const WASM_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";

const CHARS = [
  "'", "-", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
  "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X",
  "Y", "Z", "Ä", "Ö", "Ü", "’",
];

const WIDTH = 256;
const HEIGHT = 48;
const NUM_CHARS = CHARS.length + 1; // + ctc blank
const NUM_TIMESTEPS = WIDTH / 8;

const INKS = ["#1f1f28", "#1d2a66", "#7a1f2f"];

type Point = { x: number; y: number };
type Rect = { minX: number; maxX: number; minY: number; maxY: number };

let sessionPromise: Promise<InferenceSession> | null = null;

function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = WASM_CDN;
      return ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    })();
  }
  return sessionPromise;
}

export function HandwritingPad({ onResult }: { onResult: (text: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const colorRef = useRef(INKS[0]);
  const erasingRef = useRef(false);
  const drawingRef = useRef(false);
  const lastRef = useRef<Point | null>(null);
  const [color, setColor] = useState(INKS[0]);
  const [erasing, setErasing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ocr")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCloud(d ? Boolean(d.configured) : null))
      .catch(() => setCloud(null));
  }, []);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    erasingRef.current = erasing;
  }, [erasing]);

  useEffect(() => {
    getSession().catch(() => {
      setError("Could not load the handwriting model. Check your connection and retry.");
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(container.clientWidth, 200);
    const h = Math.max(Math.min(Math.round(w * 0.35), 220), 120);
    sizeRef.current = { w, h, dpr };
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function toPoint(e: React.PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function drawLine(from: Point, to: Point) {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = erasingRef.current ? "#ffffff" : colorRef.current;
    ctx.lineWidth = erasingRef.current ? 22 : 4;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function drawDot(p: Point) {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = erasingRef.current ? "#ffffff" : colorRef.current;
    ctx.beginPath();
    ctx.arc(p.x, p.y, erasingRef.current ? 11 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = toPoint(e);
    lastRef.current = p;
    drawDot(p);
    setHasInk(true);
    setLastResult(null);
    setError(null);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = toPoint(e);
    if (lastRef.current) drawLine(lastRef.current, p);
    lastRef.current = p;
  }

  function onPointerUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    const { w, h, dpr } = sizeRef.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    setHasInk(false);
    setLastResult(null);
  }

  function isInk(data: Uint8ClampedArray, idx: number) {
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2] < 128;
  }

  function segmentWords(sctx: CanvasRenderingContext2D, w: number, h: number): Rect[] {
    const image = sctx.getImageData(0, 0, w, h);
    const data = image.data;
    const label = new Int32Array(w * h);
    const bounds: Rect[] = [];
    let next = 0;
    const stack: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (label[p] !== 0 || !isInk(data, p * 4)) continue;
        next++;
        const b = { minX: x, maxX: x, minY: y, maxY: y };
        bounds.push(b);
        stack.push(p);
        label[p] = next;
        while (stack.length > 0) {
          const q = stack.pop()!;
          const qx = q % w;
          const qy = (q / w) | 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = qx + dx;
              const ny = qy + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const n = ny * w + nx;
              if (label[n] !== 0 || !isInk(data, n * 4)) continue;
              label[n] = next;
              if (nx < b.minX) b.minX = nx;
              if (nx > b.maxX) b.maxX = nx;
              if (ny < b.minY) b.minY = ny;
              if (ny > b.maxY) b.maxY = ny;
              stack.push(n);
            }
          }
        }
      }
    }
    if (bounds.length === 0) return [];
    const heights = bounds.map((b) => b.maxY - b.minY).sort((a, b) => a - b);
    const med = heights[heights.length >> 1];
    const gap = Math.max(med * 0.6, 14);
    const sorted = [...bounds].sort((a, b) => a.minX - b.minX);
    const words: Rect[] = [];
    let cur = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minX - cur.maxX > gap) {
        words.push(cur);
        cur = { ...sorted[i] };
      } else {
        cur.minX = Math.min(cur.minX, sorted[i].minX);
        cur.maxX = Math.max(cur.maxX, sorted[i].maxX);
        cur.minY = Math.min(cur.minY, sorted[i].minY);
        cur.maxY = Math.max(cur.maxY, sorted[i].maxY);
      }
    }
    words.push(cur);
    return words;
  }

  function wordToTensor(sheet: HTMLCanvasElement, rect: Rect): Float32Array {
    const bw = rect.maxX - rect.minX + 1;
    const bh = rect.maxY - rect.minY + 1;
    const scaled = document.createElement("canvas");
    scaled.width = WIDTH;
    scaled.height = HEIGHT;
    const sctx = scaled.getContext("2d")!;
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, WIDTH, HEIGHT);
    const fit = Math.min(HEIGHT / bh, WIDTH / bw);
    const dw = Math.round(bw * fit);
    const dh = Math.round(bh * fit);
    sctx.drawImage(sheet, rect.minX, rect.minY, bw, bh, (WIDTH - dw) / 2, (HEIGHT - dh) / 2, dw, dh);
    const data = sctx.getImageData(0, 0, WIDTH, HEIGHT).data;
    const arr = new Float32Array(WIDTH * HEIGHT);
    for (let i = 0; i < arr.length; i++) {
      arr[i] =
        (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255 - 0.5;
    }
    return arr;
  }

  function decode(predictions: Float32Array): string {
    let text = "";
    let prev = -1;
    for (let t = 0; t < NUM_TIMESTEPS; t++) {
      let bestIdx = 0;
      let best = Number.NEGATIVE_INFINITY;
      const off = t * NUM_CHARS;
      for (let c = 0; c < NUM_CHARS; c++) {
        if (predictions[off + c] > best) {
          best = predictions[off + c];
          bestIdx = c;
        }
      }
      if (bestIdx !== 0 && bestIdx !== prev) text += CHARS[bestIdx - 1];
      prev = bestIdx;
    }
    return text;
  }

  async function recognizeCloud(): Promise<{ text: string | null; skippable: boolean }> {
    const canvas = canvasRef.current!;
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: canvas.toDataURL("image/png") }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const skippable = data?.code === "NOT_CONFIGURED" || data?.code === "TOO_LARGE";
        return { text: null, skippable };
      }
      const text = typeof data?.text === "string" ? data.text.trim() : "";
      return { text: text || null, skippable: true };
    } catch {
      return { text: null, skippable: false };
    }
  }

  async function recognizeOffline(): Promise<boolean> {
    const { w, h } = sizeRef.current;
    if (!w || !h) return false;
    const canvas = canvasRef.current!;
    try {
      const session = await getSession();
      const sheet = document.createElement("canvas");
      sheet.width = w;
      sheet.height = h;
      const sctx = sheet.getContext("2d")!;
      sctx.drawImage(canvas, 0, 0, w, h);
      const words = segmentWords(sctx, w, h);
      if (words.length === 0) return false;
      const ort = await import("onnxruntime-web");
      const parts: string[] = [];
      for (const rect of words) {
        const tensor = new ort.Tensor(
          "float32",
          wordToTensor(sheet, rect),
          [1, 1, HEIGHT, WIDTH],
        );
        const out = await session.run({ input: tensor });
        const logits = out[session.outputNames[0]].data as Float32Array;
        const text = decode(logits);
        if (text) parts.push(text);
      }
      const text = parts.join(" ");
      if (!text) return false;
      onResult(text);
      setLastResult(text);
      clear();
      return true;
    } catch {
      return false;
    }
  }

  async function convert() {
    if (!hasInk || busy) return;
    setError(null);
    setBusy(true);
    try {
      const cloud = await recognizeCloud();
      if (cloud.text) {
        const cleaned = cloud.text.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
        if (cleaned) {
          onResult(cleaned);
          setLastResult(cleaned);
          clear();
        }
      } else {
        const usedOffline = await recognizeOffline();
        if (!usedOffline && !cloud.skippable) {
          setError("Recognition failed. Try neater, block capital letters.");
        }
      }
    } finally {
      setBusy(false);
    }
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
        {INKS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Pen color ${c}`}
            onClick={() => {
              setColor(c);
              setErasing(false);
            }}
            className={`h-6 w-6 rounded-full border transition ${
              color === c && !erasing ? "ring-2 ring-apex" : "border-line"
            }`}
            style={{ background: c }}
          />
        ))}
        <button
          type="button"
          onClick={() => setErasing((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
            erasing
              ? "border-apex/50 bg-apex/10 text-apex"
              : "border-line text-muted hover:text-foreground"
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted">
          <p>Write any way you like — cursive included — then press Convert to text.</p>
          {cloud !== null ? (
            <p className="mt-0.5">
              {cloud
                ? "Cloud OCR is on — reads cursive, sentences and punctuation."
                : "Cloud OCR not configured — using the smaller offline model. Add a Google Vision API key for full cursive/sentence reading."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={convert}
          disabled={!hasInk || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-apex-gradient px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Converting…
            </>
          ) : (
            <>
              <ScanText size={13} /> Convert to text
            </>
          )}
        </button>
      </div>

      {lastResult ? (
        <p className="mt-2 text-xs text-emerald-400">
          Added <span className="font-semibold">{lastResult}</span> to your task title.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle size={13} /> {error}
        </p>
      ) : null}
    </div>
  );
}