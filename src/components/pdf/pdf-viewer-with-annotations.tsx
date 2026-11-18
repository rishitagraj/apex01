'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Pen,
  Highlighter,
  Square,
  Circle,
  Type,
  Eraser,
  MousePointer,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui';

type Tool = 'select' | 'pen' | 'highlighter' | 'rect' | 'circle' | 'text' | 'eraser';

type Annotation = {
  id: string;
  page: number;
  type: Tool;
  color: string;
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  strokeWidth?: number;
};

export function PdfViewerWithAnnotations({ url, fileName, fullScreen = false }: { url: string; fileName?: string; fullScreen?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(fullScreen ? 1.0 : 1.2);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#f59e0b');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const drawingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const pdfjsLib = await import('pdfjs-dist');
        // Use the worker from pdfjs-dist
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.height = viewport.height + 'px';
      canvas.style.width = viewport.width + 'px';
      
      if (overlayRef.current) {
        overlayRef.current.height = viewport.height;
        overlayRef.current.width = viewport.width;
        overlayRef.current.style.height = viewport.height + 'px';
        overlayRef.current.style.width = viewport.width + 'px';
      }
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
    } catch (e) {
      console.error('Render error:', e);
    }
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Load annotations from localStorage
  useEffect(() => {
    const key = `pdf-annotations-${url}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setAnnotations(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load annotations:', e);
    }
  }, [url]);

  // Save annotations to localStorage
  useEffect(() => {
    const key = `pdf-annotations-${url}`;
    try {
      localStorage.setItem(key, JSON.stringify(annotations));
    } catch (e) {
      console.error('Failed to save annotations:', e);
    }
  }, [annotations, url]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const pointNearLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number, threshold = 12) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1; yy = y1;
    } else if (param > 1) {
      xx = x2; yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  };

  const isPointNearAnnotation = (pos: { x: number; y: number }, ann: Annotation) => {
    const baseThreshold = 12;
    if (ann.type === 'pen') {
      const threshold = (ann.strokeWidth || 2) + baseThreshold;
      if (!ann.points || ann.points.length === 0) return false;
      if (ann.points.length === 1) {
        const dx = pos.x - ann.points[0].x;
        const dy = pos.y - ann.points[0].y;
        return Math.sqrt(dx * dx + dy * dy) < threshold + 5;
      }
      for (let i = 1; i < ann.points.length; i++) {
        if (pointNearLine(pos.x, pos.y, ann.points[i - 1].x, ann.points[i - 1].y, ann.points[i].x, ann.points[i].y, threshold)) {
          return true;
        }
      }
      return false;
    } else if (ann.type === 'highlighter') {
      const threshold = (ann.strokeWidth || 20) / 2 + baseThreshold;
      if (!ann.points || ann.points.length === 0) return false;
      if (ann.points.length === 1) {
        const dx = pos.x - ann.points[0].x;
        const dy = pos.y - ann.points[0].y;
        return Math.sqrt(dx * dx + dy * dy) < threshold + 5;
      }
      for (let i = 1; i < ann.points.length; i++) {
        if (pointNearLine(pos.x, pos.y, ann.points[i - 1].x, ann.points[i - 1].y, ann.points[i].x, ann.points[i].y, threshold)) {
          return true;
        }
      }
      return false;
    } else if (ann.type === 'rect') {
      const threshold = baseThreshold;
      const x = ann.x || 0, y = ann.y || 0, w = ann.width || 0, h = ann.height || 0;
      if (pointNearLine(pos.x, pos.y, x, y, x + w, y, threshold) ||
          pointNearLine(pos.x, pos.y, x + w, y, x + w, y + h, threshold) ||
          pointNearLine(pos.x, pos.y, x + w, y + h, x, y + h, threshold) ||
          pointNearLine(pos.x, pos.y, x, y + h, x, y, threshold)) {
        return true;
      }
      return false;
    } else if (ann.type === 'circle') {
      const cx = (ann.x || 0) + (ann.width || 0) / 2;
      const cy = (ann.y || 0) + (ann.height || 0) / 2;
      const rx = Math.abs(ann.width || 0) / 2;
      const ry = Math.abs(ann.height || 0) / 2;
      const dist = Math.sqrt(((pos.x - cx) / Math.max(rx, 1)) ** 2 + ((pos.y - cy) / Math.max(ry, 1)) ** 2);
      return Math.abs(dist - 1) < 0.2;
    } else if (ann.type === 'text') {
      if (ann.x !== undefined && ann.y !== undefined) {
        return pos.x > ann.x - 15 && pos.x < ann.x + 150 && pos.y > ann.y - 25 && pos.y < ann.y + 15;
      }
      return false;
    }
    return false;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getMousePos(e);
    
    if (tool === 'eraser') {
      const toDelete = annotations
        .filter((ann) => ann.page === pageNum)
        .find((ann) => isPointNearAnnotation(pos, ann));
      if (toDelete) {
        setAnnotations((prev) => prev.filter((a) => a.id !== toDelete.id));
      }
      drawingRef.current = true;
      return;
    }
    
    drawingRef.current = true;
    setIsDrawing(true);
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    if (tool === 'pen' || tool === 'highlighter') {
      setCurrentAnnotation({
        id,
        page: pageNum,
        type: tool,
        color,
        points: [pos],
        strokeWidth: tool === 'highlighter' ? 18 : 2,
      });
    } else if (tool === 'rect') {
      setCurrentAnnotation({
        id,
        page: pageNum,
        type: tool,
        color,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        strokeWidth: 2,
      });
    } else if (tool === 'circle') {
      setCurrentAnnotation({
        id,
        page: pageNum,
        type: tool,
        color,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        strokeWidth: 2,
      });
    } else if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        setAnnotations((prev) => [
          ...prev,
          {
            id,
            page: pageNum,
            type: tool,
            color,
            x: pos.x,
            y: pos.y,
            text,
            strokeWidth: 16,
          },
        ]);
      }
      drawingRef.current = false;
      setIsDrawing(false);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getMousePos(e);
    
    if (tool === 'eraser') {
      setAnnotations((prev) => {
        const idx = prev.findIndex((ann) => ann.page === pageNum && isPointNearAnnotation(pos, ann));
        if (idx >= 0) {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        return prev;
      });
      return;
    }
    
    if (tool === 'pen' || tool === 'highlighter') {
      setCurrentAnnotation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          points: [...(prev.points || []), pos],
        };
      });
      return;
    }
    
    if (!currentAnnotation) return;
    
    if (tool === 'rect' || tool === 'circle') {
      setCurrentAnnotation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          width: pos.x - (prev.x || 0),
          height: pos.y - (prev.y || 0),
        };
      });
    }
  };

  const stopDrawing = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (drawingRef.current && tool !== 'eraser' && currentAnnotation) {
      if (tool === 'pen' || tool === 'highlighter') {
        if (currentAnnotation.points && currentAnnotation.points.length > 1) {
          setAnnotations((prev) => [...prev, currentAnnotation]);
        }
      } else if (tool === 'rect' || tool === 'circle') {
        if (Math.abs(currentAnnotation.width || 0) > 3 && Math.abs(currentAnnotation.height || 0) > 3) {
          setAnnotations((prev) => [...prev, currentAnnotation]);
        }
      }
    }
    drawingRef.current = false;
    setIsDrawing(false);
    setCurrentAnnotation(null);
  };

  const drawAnnotations = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const pageAnnotations = [...annotations.filter((a) => a.page === pageNum), currentAnnotation].filter(Boolean) as Annotation[];
    
    for (const ann of pageAnnotations) {
      ctx.save();
      if (ann.type === 'pen') {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (ann.points && ann.points.length > 0) {
          ctx.moveTo(ann.points[0].x, ann.points[0].y);
          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x, ann.points[i].y);
          }
        }
        ctx.stroke();
      } else if (ann.type === 'highlighter') {
        ctx.strokeStyle = ann.color + '44';
        ctx.lineWidth = ann.strokeWidth || 18;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'multiply';
        ctx.beginPath();
        if (ann.points && ann.points.length > 0) {
          ctx.moveTo(ann.points[0].x, ann.points[0].y);
          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x, ann.points[i].y);
          }
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (ann.type === 'rect') {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.strokeRect(ann.x || 0, ann.y || 0, ann.width || 0, ann.height || 0);
      } else if (ann.type === 'circle') {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.beginPath();
        const rx = Math.abs(ann.width || 0) / 2;
        const ry = Math.abs(ann.height || 0) / 2;
        const cx = (ann.x || 0) + (ann.width || 0) / 2;
        const cy = (ann.y || 0) + (ann.height || 0) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (ann.type === 'text') {
        ctx.fillStyle = ann.color;
        ctx.font = `${ann.strokeWidth || 16}px Arial`;
        ctx.fillText(ann.text || '', ann.x || 0, ann.y || 0);
      }
      ctx.restore();
    }
  }, [annotations, pageNum, currentAnnotation]);

  useEffect(() => {
    drawAnnotations();
  }, [drawAnnotations, annotations, currentAnnotation, pageNum]);

  const clearAnnotations = () => {
    if (confirm('Clear all annotations for this PDF?')) {
      setAnnotations([]);
    }
  };

  const deletePageAnnotations = () => {
    if (confirm('Clear all annotations on this page?')) {
      setAnnotations((prev) => prev.filter((a) => a.page !== pageNum));
    }
  };

  const goToPrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const goToNextPage = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.6));

  const downloadAnnotated = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${fileName || 'document'}-page${pageNum}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const tools: Array<{ id: Tool; icon: any; label: string }> = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'eraser', icon: Eraser, label: 'Clear' },
  ];

  const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#000000'];

  return (
    <div className={`flex flex-col ${fullScreen ? 'h-full' : 'h-[calc(100vh-200px)]'} ${fullScreen ? '' : 'rounded-2xl border border-line'} bg-[#323639]`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2 text-white">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`rounded p-1.5 transition ${
                  tool === t.id ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                title={t.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-white/20" />

        <div className="flex items-center gap-1">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-white/30'}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <div className="h-6 w-px bg-white/20" />

        <div className="flex items-center gap-1">
          <button onClick={goToPrevPage} disabled={pageNum <= 1} className="rounded p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="px-2 text-xs text-white/80">
            Page {pageNum} / {numPages}
          </span>
          <button onClick={goToNextPage} disabled={pageNum >= numPages} className="rounded p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="h-6 w-px bg-white/20" />

        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="rounded p-1.5 text-white/70 hover:bg-white/10">
            <ZoomOut size={16} />
          </button>
          <span className="px-2 text-xs text-white/80">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="rounded p-1.5 text-white/70 hover:bg-white/10">
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={clearAnnotations} title="Clear all annotations" className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10">
            <Trash2 size={16} /> Clear All
          </button>
          <button onClick={downloadAnnotated} title="Download current page as image" className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10">
            <Download size={16} /> Download Page
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div ref={containerRef} className="flex-1 overflow-scroll bg-[#525659] p-4" style={{ overflowX: 'scroll', overflowY: 'scroll', touchAction: 'pan-x pan-y' }}>
        {loading && (
          <div className="flex h-full items-center justify-center text-white/70">
            Loading PDF...
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-red-400">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="relative inline-block" style={{ minWidth: '100%' }}>
            <div className="relative mx-auto" style={{ width: canvasRef.current?.width || 'auto', height: canvasRef.current?.height || 'auto' }}>
              <canvas ref={canvasRef} className="shadow-2xl block" />
              <canvas
                ref={overlayRef}
                className="absolute left-0 top-0"
                style={{ cursor: tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none', userSelect: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          </div>
        )}
      </div>

      {!fullScreen && (
        <div className="border-t border-line p-2 text-center text-xs text-muted">
          💡 Annotations are saved locally in your browser
        </div>
      )}
    </div>
  );
}
