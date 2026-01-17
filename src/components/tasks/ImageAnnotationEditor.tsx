import React, { useCallback, useEffect, useRef, useState } from "react";
import { PenLine, ArrowRight, Circle, Type, Undo2, Trash2, Save, X, ZoomIn, ZoomOut, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AnnotationPayload, AnnotationSavePayload } from "@/types/annotation-payload";

type Tool = "select" | "pen" | "arrow" | "circle" | "text";

type TextEditState = {
  index: number | null;
  position: [number, number];
  value: string;
};

interface ImageAnnotationEditorProps {
  imageUrl: string;
  initialAnnotations?: AnnotationPayload[];
  onSave: (data: AnnotationSavePayload) => void;
  onCancel: () => void;
  auditInfo?: {
    createdAt?: string;
    createdBy?: string;
    editedAt?: string;
    editedBy?: string;
  };
}

const DEFAULT_COLOR = "#2C2C2C";
const DEFAULT_THICKNESS = 2;
const MIN_SCALE = 0.6;
const MAX_SCALE = 4;
const PALETTE = [
  { name: "black", hex: "#111111" },
  { name: "white", hex: "#FFFFFF" },
  { name: "yellow", hex: "#FACC15" },
  { name: "red", hex: "#EF4444" },
  { name: "blue", hex: "#3B82F6" },
  { name: "green", hex: "#22C55E" },
];

export function ImageAnnotationEditor({
  imageUrl,
  initialAnnotations = [],
  onSave,
  onCancel,
  auditInfo,
}: ImageAnnotationEditorProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    initialDistance: number;
    initialScale: number;
    initialOffset: { x: number; y: number };
    initialMid: { x: number; y: number };
  } | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [annotations, setAnnotations] = useState<AnnotationPayload[]>(initialAnnotations);
  const [history, setHistory] = useState<AnnotationPayload[][]>([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<"move" | "rotate" | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragSnapshot, setDragSnapshot] = useState<AnnotationPayload | null>(null);
  const [dragCenter, setDragCenter] = useState<{ x: number; y: number } | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const [currentColor, setCurrentColor] = useState(DEFAULT_COLOR);
  const [currentThickness, setCurrentThickness] = useState(DEFAULT_THICKNESS);
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [imageRect, setImageRect] = useState<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });

  const toolbarButtonClass = cn(
    "h-12 w-12 rounded-xl shadow-e1 bg-surface-gradient flex items-center justify-center",
    "hover:shadow-e2 active:shadow-btn-pressed transition-all"
  );

  const pushHistory = useCallback(
    (next: AnnotationPayload[]) => {
      const sliced = history.slice(0, historyIndex + 1);
      const updated = [...sliced, next];
      setHistory(updated);
      setHistoryIndex(updated.length - 1);
    },
    [history, historyIndex]
  );

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setAnnotations(history[nextIndex]);
  }, [history, historyIndex]);

  const deleteSelected = useCallback(() => {
    if (annotations.length === 0) return;
    if (selectedIndex === null) {
      const next = annotations.slice(0, -1);
      setAnnotations(next);
      pushHistory(next);
      return;
    }
    const next = annotations.filter((_, idx) => idx !== selectedIndex);
    setSelectedIndex(null);
    setAnnotations(next);
    pushHistory(next);
  }, [annotations, pushHistory, selectedIndex]);

  const loadImage = useCallback(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      recalcLayout();
      draw();
    };
    img.onerror = () => {
      imageRef.current = null;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const recalcLayout = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!container || !canvas || !img) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    const offsetX = (rect.width - width) / 2;
    const offsetY = (rect.height - height) / 2;

    setImageRect({ offsetX, offsetY, width, height });
  }, []);

  const toCanvasPoint = useCallback(
    (point: [number, number]) => {
      const rect = imageRect;
      if (!rect) return { x: 0, y: 0 };
      return {
        x: rect.offsetX + viewOffset.x + point[0] * rect.width * viewScale,
        y: rect.offsetY + viewOffset.y + point[1] * rect.height * viewScale,
      };
    },
    [imageRect, viewOffset.x, viewOffset.y, viewScale]
  );

  const fromCanvasPoint = useCallback(
    (x: number, y: number) => {
      const rect = imageRect;
      if (!rect) return [0, 0] as [number, number];
      const relX = (x - rect.offsetX - viewOffset.x) / (rect.width * viewScale);
      const relY = (y - rect.offsetY - viewOffset.y) / (rect.height * viewScale);
      return [Math.min(1, Math.max(0, relX)), Math.min(1, Math.max(0, relY))] as [number, number];
    },
    [imageRect, viewOffset.x, viewOffset.y, viewScale]
  );

  const getAnnotationBounds = useCallback(
    (ann: AnnotationPayload) => {
      if (!ann.points || ann.points.length === 0) return null;
      if (ann.type === "circle" && ann.points.length === 2) {
        const [c, r] = ann.points;
        const center = toCanvasPoint(c);
        const edge = toCanvasPoint(r);
        const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
        return {
          minX: center.x - radius,
          minY: center.y - radius,
          maxX: center.x + radius,
          maxY: center.y + radius,
        };
      }

      if (ann.type === "text" && ann.points.length === 1) {
        const [p] = ann.points;
        const anchor = toCanvasPoint(p);
        const text = ann.content || "";
        const width = Math.max(40, text.length * 8);
        const height = 18;
        return {
          minX: anchor.x,
          minY: anchor.y - height,
          maxX: anchor.x + width,
          maxY: anchor.y,
        };
      }

      const points = ann.points.map(toCanvasPoint);
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    },
    [toCanvasPoint]
  );

  const getSelectionHandles = useCallback(
    (ann: AnnotationPayload) => {
      const bounds = getAnnotationBounds(ann);
      if (!bounds) return null;
      const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const rotate = ann.type === "pen" || ann.type === "arrow";
      return {
        move: center,
        rotate: rotate ? { x: center.x, y: bounds.minY - 18 } : null,
        bounds,
      };
    },
    [getAnnotationBounds]
  );

  const toRelative = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const canvas = canvasRef.current;
      const rect = imageRect;
      if (!canvas || !rect) return null;

      const bounds = canvas.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;

      const imageX = (x - (rect.offsetX + viewOffset.x)) / (rect.width * viewScale);
      const imageY = (y - (rect.offsetY + viewOffset.y)) / (rect.height * viewScale);

      if (imageX < 0 || imageY < 0 || imageX > 1 || imageY > 1) return null;
      return [Math.min(1, Math.max(0, imageX)), Math.min(1, Math.max(0, imageY))];
    },
    [imageRect, viewOffset.x, viewOffset.y, viewScale]
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const rect = imageRect;
      const canvas = canvasRef.current;
      if (!rect || !canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;
      const relX = (x - (rect.offsetX + viewOffset.x)) / (rect.width * viewScale);
      const relY = (y - (rect.offsetY + viewOffset.y)) / (rect.height * viewScale);

      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      const newOffsetX = x - rect.offsetX - relX * rect.width * clampedScale;
      const newOffsetY = y - rect.offsetY - relY * rect.height * clampedScale;

      setViewScale(clampedScale);
      setViewOffset({ x: newOffsetX, y: newOffsetY });
    },
    [imageRect, viewOffset.x, viewOffset.y, viewScale]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = imageRect;
    if (!canvas || !img || !rect) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#F4F3F0";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.drawImage(
      img,
      rect.offsetX + viewOffset.x,
      rect.offsetY + viewOffset.y,
      rect.width * viewScale,
      rect.height * viewScale
    );

    const drawAnnotation = (ann: AnnotationPayload) => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (ann.type === "pen" && ann.points && ann.points.length > 1) {
        ctx.beginPath();
        ann.points.forEach(([rx, ry], idx) => {
          const x = rect.offsetX + viewOffset.x + rx * rect.width * viewScale;
          const y = rect.offsetY + viewOffset.y + ry * rect.height * viewScale;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      if (ann.type === "arrow" && ann.points && ann.points.length === 2) {
        const [a, b] = ann.points;
        const x1 = rect.offsetX + viewOffset.x + a[0] * rect.width * viewScale;
        const y1 = rect.offsetY + viewOffset.y + a[1] * rect.height * viewScale;
        const x2 = rect.offsetX + viewOffset.x + b[0] * rect.width * viewScale;
        const y2 = rect.offsetY + viewOffset.y + b[1] * rect.height * viewScale;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 10 + ann.thickness * 2;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      if (ann.type === "circle" && ann.points && ann.points.length === 2) {
        const [c, r] = ann.points;
        const cx = rect.offsetX + viewOffset.x + c[0] * rect.width * viewScale;
        const cy = rect.offsetY + viewOffset.y + c[1] * rect.height * viewScale;
        const rx = rect.offsetX + viewOffset.x + r[0] * rect.width * viewScale;
        const ry = rect.offsetY + viewOffset.y + r[1] * rect.height * viewScale;
        const radius = Math.hypot(rx - cx, ry - cy);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (ann.type === "text" && ann.points && ann.points.length === 1) {
        const [p] = ann.points;
        const { x, y } = toCanvasPoint(p);
        ctx.font = "16px system-ui";
        ctx.fillText(ann.content || "", x, y);
      }
    };

    annotations.forEach(drawAnnotation);

    if (selectedIndex !== null && annotations[selectedIndex]) {
      const ann = annotations[selectedIndex];
      ctx.save();
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const drawSelectionBox = (minX: number, minY: number, maxX: number, maxY: number) => {
        ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
      };

      const bounds = getAnnotationBounds(ann);
      if (bounds) {
        drawSelectionBox(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
      }

      const handles = getSelectionHandles(ann);
      if (handles) {
        ctx.setLineDash([]);
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 2;

        const drawHandle = (x: number, y: number) => {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        };

        drawHandle(handles.move.x, handles.move.y);
        if (handles.rotate) {
          drawHandle(handles.rotate.x, handles.rotate.y);
        }
      }
      ctx.restore();
    }

    if (isDrawing && currentPoints.length > 0) {
      const temp: AnnotationPayload = {
        type: tool,
        points: currentPoints,
        color: currentColor,
        thickness: currentThickness,
      };
      drawAnnotation(temp);
    }
  }, [annotations, currentColor, currentPoints, currentThickness, getAnnotationBounds, getSelectionHandles, imageRect, isDrawing, selectedIndex, tool, toCanvasPoint, viewOffset.x, viewOffset.y, viewScale]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  useEffect(() => {
    const handleResize = () => {
      recalcLayout();
      draw();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw, recalcLayout]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    setIsDrawing(false);
    setCurrentPoints([]);
  }, [tool]);

  useEffect(() => {
    if (textEdit) {
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
      });
    }
  }, [textEdit]);

  const openTextEditor = useCallback(
    (position: [number, number], index: number | null) => {
      const existingText = index !== null ? annotations[index]?.content || "" : "";
      setTextEdit({ index, position, value: existingText });
      setSelectedIndex(index);
    },
    [annotations]
  );

  const applyTextEdit = useCallback(
    (current: AnnotationPayload[], edit: TextEditState) => {
      const value = edit.value.trim();
      if (!value) {
        return { next: current, applied: false, selected: null as number | null };
      }

      if (edit.index === null) {
        const next: AnnotationPayload = {
          type: "text",
          points: [edit.position],
          color: currentColor,
          thickness: currentThickness,
          content: value,
        };
        return { next: [...current, next], applied: true, selected: current.length };
      }

      return {
        next: current.map((ann, idx) => (idx === edit.index ? { ...ann, content: value } : ann)),
        applied: true,
        selected: edit.index,
      };
    },
    [currentColor, currentThickness]
  );

  const commitTextEdit = useCallback(() => {
    if (!textEdit) return;
    const { next, applied, selected } = applyTextEdit(annotations, textEdit);
    if (applied) {
      setAnnotations(next);
      pushHistory(next);
      setSelectedIndex(selected);
    }
    setTextEdit(null);
  }, [annotations, applyTextEdit, pushHistory, textEdit]);

  const getTextBounds = useCallback((ann: AnnotationPayload) => {
    if (!ann.points || ann.points.length !== 1) return null;
    const [p] = ann.points;
    const anchor = toCanvasPoint(p);
    const text = ann.content || "";
    const width = Math.max(40, text.length * 8);
    const height = 18;
    return { minX: anchor.x, minY: anchor.y - height, maxX: anchor.x + width, maxY: anchor.y };
  }, [toCanvasPoint]);

  const hitTest = useCallback(
    (point: [number, number]) => {
      const rect = imageRect;
      if (!rect) return null;
      const target = toCanvasPoint(point);
      const threshold = 12;

      for (let i = annotations.length - 1; i >= 0; i -= 1) {
        const ann = annotations[i];
        if (!ann.points || ann.points.length === 0) continue;

        if (ann.type === "text") {
          const bounds = getTextBounds(ann);
          if (bounds && target.x >= bounds.minX && target.x <= bounds.maxX && target.y >= bounds.minY && target.y <= bounds.maxY) {
            return i;
          }
          continue;
        }

        if (ann.type === "circle" && ann.points.length === 2) {
          const [c, r] = ann.points;
          const center = toCanvasPoint(c);
          const edge = toCanvasPoint(r);
          const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
          const dist = Math.hypot(target.x - center.x, target.y - center.y);
          if (Math.abs(dist - radius) <= threshold) return i;
          continue;
        }

        if (ann.type === "arrow" && ann.points.length === 2) {
          const [a, b] = ann.points.map(toCanvasPoint);
          const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const t = ((target.x - a.x) * (b.x - a.x) + (target.y - a.y) * (b.y - a.y)) / (length * length);
          const clamped = Math.min(1, Math.max(0, t));
          const projX = a.x + clamped * (b.x - a.x);
          const projY = a.y + clamped * (b.y - a.y);
          const dist = Math.hypot(target.x - projX, target.y - projY);
          if (dist <= threshold) return i;
          continue;
        }

        if (ann.type === "pen") {
          const points = ann.points.map(toCanvasPoint);
          for (const p of points) {
            if (Math.hypot(target.x - p.x, target.y - p.y) <= threshold) {
              return i;
            }
          }
        }
      }

      return null;
    },
    [annotations, getTextBounds, imageRect, toCanvasPoint]
  );

  const hitTestHandle = useCallback(
    (point: [number, number]) => {
      if (selectedIndex === null) return null;
      const ann = annotations[selectedIndex];
      if (!ann) return null;
      const handles = getSelectionHandles(ann);
      if (!handles) return null;
      const target = toCanvasPoint(point);
      const radius = 10;
      if (Math.hypot(target.x - handles.move.x, target.y - handles.move.y) <= radius) {
        return "move" as const;
      }
      if (handles.rotate && Math.hypot(target.x - handles.rotate.x, target.y - handles.rotate.y) <= radius) {
        return "rotate" as const;
      }
      return null;
    },
    [annotations, getSelectionHandles, selectedIndex, toCanvasPoint]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const values = Array.from(pointers.values());
      const dx = values[0].x - values[1].x;
      const dy = values[0].y - values[1].y;
      const distance = Math.hypot(dx, dy);
      const mid = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
      gestureRef.current = {
        initialDistance: distance,
        initialScale: viewScale,
        initialOffset: { ...viewOffset },
        initialMid: mid,
      };
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    if (pointers.size > 1) return;

    const rel = toRelative(e.clientX, e.clientY);
    if (!rel) return;

    if (textEdit) {
      commitTextEdit();
    }

    if (tool === "select") {
      const handle = hitTestHandle(rel);
      if (handle && selectedIndex !== null) {
        const ann = annotations[selectedIndex];
        if (ann) {
          setDragMode(handle);
          setDragStart(toCanvasPoint(rel));
          setDragSnapshot(JSON.parse(JSON.stringify(ann)) as AnnotationPayload);
          const bounds = getAnnotationBounds(ann);
          if (bounds) {
            setDragCenter({
              x: (bounds.minX + bounds.maxX) / 2,
              y: (bounds.minY + bounds.maxY) / 2,
            });
          }
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          return;
        }
      }

      const hit = hitTest(rel);
      if (hit === null) {
        setTextEdit(null);
        setSelectedIndex(null);
        return;
      }

      setSelectedIndex(hit);
      setCurrentColor(annotations[hit]?.color || DEFAULT_COLOR);
      setCurrentThickness(annotations[hit]?.thickness || DEFAULT_THICKNESS);

      // Only open text editor on second click when already selected
      if (annotations[hit]?.type === "text" && selectedIndex === hit) {
        const anchor = annotations[hit]?.points?.[0] || rel;
        openTextEditor(anchor, hit);
      }
      return;
    }

    setSelectedIndex(null);

    if (tool === "text") {
      openTextEditor(rel, null);
      return;
    }

    setIsDrawing(true);
    if (tool === "pen") {
      setCurrentPoints([rel]);
    } else {
      setCurrentPoints([rel, rel]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointers.size === 2 && gestureRef.current) {
      const values = Array.from(pointers.values());
      const dx = values[0].x - values[1].x;
      const dy = values[0].y - values[1].y;
      const distance = Math.hypot(dx, dy);
      const mid = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };

      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, gestureRef.current.initialScale * (distance / gestureRef.current.initialDistance))
      );
      const offset = {
        x: gestureRef.current.initialOffset.x + (mid.x - gestureRef.current.initialMid.x),
        y: gestureRef.current.initialOffset.y + (mid.y - gestureRef.current.initialMid.y),
      };
      setViewScale(scale);
      setViewOffset(offset);
      return;
    }

    if (dragMode && dragSnapshot && dragStart && dragCenter) {
      const rel = toRelative(e.clientX, e.clientY);
      if (!rel) return;
      const current = toCanvasPoint(rel);
      const deltaX = current.x - dragStart.x;
      const deltaY = current.y - dragStart.y;
      const updated = [...annotations];
      const idx = selectedIndex;
      if (idx === null) return;

      if (dragMode === "move") {
        const movePoint = (p: [number, number]) => {
          const canvasP = toCanvasPoint(p);
          const moved = { x: canvasP.x + deltaX, y: canvasP.y + deltaY };
          return fromCanvasPoint(moved.x, moved.y);
        };

        if (dragSnapshot.points) {
          updated[idx] = {
            ...dragSnapshot,
            points: dragSnapshot.points.map((p) => movePoint(p)),
          };
        }
        setAnnotations(updated);
        return;
      }

      if (dragMode === "rotate" && (dragSnapshot.type === "pen" || dragSnapshot.type === "arrow")) {
        const angleStart = Math.atan2(dragStart.y - dragCenter.y, dragStart.x - dragCenter.x);
        const angleNow = Math.atan2(current.y - dragCenter.y, current.x - dragCenter.x);
        const angle = angleNow - angleStart;
        const rotatePoint = (p: [number, number]) => {
          const canvasP = toCanvasPoint(p);
          const dx = canvasP.x - dragCenter.x;
          const dy = canvasP.y - dragCenter.y;
          const rx = dragCenter.x + dx * Math.cos(angle) - dy * Math.sin(angle);
          const ry = dragCenter.y + dx * Math.sin(angle) + dy * Math.cos(angle);
          return fromCanvasPoint(rx, ry);
        };

        if (dragSnapshot.points) {
          updated[idx] = {
            ...dragSnapshot,
            points: dragSnapshot.points.map((p) => rotatePoint(p)),
          };
        }
        setAnnotations(updated);
        return;
      }
    }

    if (!isDrawing) return;
    const rel = toRelative(e.clientX, e.clientY);
    if (!rel) return;

    if (tool === "pen") {
      setCurrentPoints((prev) => [...prev, rel]);
    } else {
      setCurrentPoints((prev) => (prev.length === 0 ? [rel] : [prev[0], rel]));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    pointers.delete(e.pointerId);

    if (pointers.size < 2) {
      gestureRef.current = null;
    }

    if (dragMode) {
      if (selectedIndex !== null && dragSnapshot) {
        pushHistory(annotations);
      }
      setDragMode(null);
      setDragStart(null);
      setDragSnapshot(null);
      setDragCenter(null);
      return;
    }

    if (!isDrawing) return;

    const isValid =
      (tool === "pen" && currentPoints.length > 1) ||
      (tool !== "pen" && currentPoints.length === 2);

    if (isValid) {
      const next: AnnotationPayload = {
        type: tool,
        points: currentPoints,
        color: currentColor,
        thickness: currentThickness,
      };
      const updated = [...annotations, next];
      setAnnotations(updated);
      pushHistory(updated);
    }

    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!imageRect) return;
      if (e.cancelable) {
        e.preventDefault();
      }
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      zoomAt(e.clientX, e.clientY, viewScale + delta);
    },
    [imageRect, viewScale, zoomAt]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  const zoomAtCenter = useCallback(
    (nextScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, nextScale);
    },
    [zoomAt]
  );

  const resetView = () => {
    setViewScale(1);
    setViewOffset({ x: 0, y: 0 });
  };

  const handleSave = () => {
    let nextAnnotations = annotations;
    if (textEdit) {
      const { next, applied, selected } = applyTextEdit(annotations, textEdit);
      if (applied) {
        setAnnotations(next);
        pushHistory(next);
        setSelectedIndex(selected);
      }
      setTextEdit(null);
      nextAnnotations = next;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let previewDataUrl = "";
    try {
      previewDataUrl = canvas.toDataURL("image/webp", 0.85);
    } catch (error) {
      try {
        previewDataUrl = canvas.toDataURL("image/png");
      } catch {
        previewDataUrl = "";
      }
      console.warn("Preview export failed:", error);
    }

    onSave({
      annotations: nextAnnotations,
      previewDataUrl,
    });
  };

  const canUndo = historyIndex > 0;
  const canDelete = annotations.length > 0;
  const selectedAnnotation = selectedIndex !== null ? annotations[selectedIndex] : null;
  const activeThickness = selectedAnnotation?.thickness ?? currentThickness;
  const activeColor = selectedAnnotation?.color ?? currentColor;
  const isDrawingTool = tool !== "select";

  return (
    <div className="relative w-full h-full bg-surface-gradient">
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button className={toolbarButtonClass} onClick={onCancel} aria-label="Cancel">
          <X className="h-5 w-5" />
        </button>
        <button className={toolbarButtonClass} onClick={handleSave} aria-label="Save">
          <Save className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button className={toolbarButtonClass} onClick={() => zoomAtCenter(viewScale + 0.2)} aria-label="Zoom in">
          <ZoomIn className="h-5 w-5" />
        </button>
        <button className={toolbarButtonClass} onClick={() => zoomAtCenter(viewScale - 0.2)} aria-label="Zoom out">
          <ZoomOut className="h-5 w-5" />
        </button>
        <button className={toolbarButtonClass} onClick={resetView} aria-label="Reset zoom">
          <span className="text-xs font-semibold">100%</span>
        </button>
      </div>

      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-full touch-none"
        />
        {textEdit && imageRect && (
          <input
            ref={textInputRef}
            value={textEdit.value}
            onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
            onBlur={commitTextEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitTextEdit();
              }
              if (e.key === "Escape") {
                setTextEdit(null);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute z-20 h-10 px-2 rounded-lg shadow-e1 bg-input input-neomorphic text-sm"
            style={{
              left: toCanvasPoint(textEdit.position).x,
              top: toCanvasPoint(textEdit.position).y,
              transform: "translate(0, -100%)",
              minWidth: "160px",
            }}
            placeholder="Type text..."
          />
        )}
      </div>

      <div
        className={cn(
          "absolute z-20 flex gap-3 items-center p-3 bg-surface-gradient shadow-e2 rounded-2xl",
          isMobile ? "bottom-4 right-4" : "bottom-4 right-4 flex-col"
        )}
      >
        <button className={toolbarButtonClass} onClick={() => setTool("select")} aria-label="Select">
          <MousePointer2 className={cn("h-5 w-5", tool === "select" && "text-primary")} />
        </button>
        <button className={toolbarButtonClass} onClick={() => setTool("pen")} aria-label="Pen">
          <PenLine className={cn("h-5 w-5", tool === "pen" && "text-primary")} />
        </button>
        <button className={toolbarButtonClass} onClick={() => setTool("arrow")} aria-label="Arrow">
          <ArrowRight className={cn("h-5 w-5", tool === "arrow" && "text-primary")} />
        </button>
        <button className={toolbarButtonClass} onClick={() => setTool("circle")} aria-label="Circle">
          <Circle className={cn("h-5 w-5", tool === "circle" && "text-primary")} />
        </button>
        <button className={toolbarButtonClass} onClick={() => setTool("text")} aria-label="Text">
          <Type className={cn("h-5 w-5", tool === "text" && "text-primary")} />
        </button>
        <button
          className={cn(toolbarButtonClass, !canUndo && "opacity-50")}
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          className={cn(toolbarButtonClass, !canDelete && "opacity-50")}
          onClick={deleteSelected}
          disabled={!canDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {(selectedAnnotation || isDrawingTool) && (
        <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 p-2 bg-surface-gradient shadow-e2 rounded-2xl">
          <div className="flex items-center gap-2">
            {PALETTE.map((color) => (
              <button
                key={color.name}
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full border-2 shadow-e1 transition-all",
                  activeColor === color.hex ? "border-primary" : "border-transparent"
                )}
                style={{ backgroundColor: color.hex }}
                onClick={() => {
                  if (selectedIndex !== null) {
                    const updated = annotations.map((ann, idx) =>
                      idx === selectedIndex ? { ...ann, color: color.hex } : ann
                    );
                    setAnnotations(updated);
                    pushHistory(updated);
                  } else {
                    setCurrentColor(color.hex);
                  }
                }}
                aria-label={`Set color ${color.name}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Thin", value: 1 },
              { label: "Medium", value: 2 },
              { label: "Bold", value: 4 },
            ].map((width) => (
              <button
                key={width.label}
                type="button"
                className={cn(
                  "h-8 w-10 rounded-xl shadow-e1 bg-surface-gradient flex items-center justify-center border",
                  activeThickness === width.value ? "border-primary" : "border-transparent"
                )}
                onClick={() => {
                  if (selectedIndex !== null) {
                    const updated = annotations.map((ann, idx) =>
                      idx === selectedIndex ? { ...ann, thickness: width.value } : ann
                    );
                    setAnnotations(updated);
                    pushHistory(updated);
                  } else {
                    setCurrentThickness(width.value);
                  }
                }}
                aria-label={`Set thickness ${width.label}`}
              >
                <span className="block w-6 rounded-full bg-foreground/70" style={{ height: width.value }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-[92px] z-20 rounded-2xl bg-surface-gradient shadow-e2 px-3 py-2 text-[11px] text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">Created:</span>{" "}
          {auditInfo?.createdAt || "—"}{" "}
          <span className="text-muted-foreground">by</span>{" "}
          {auditInfo?.createdBy || "—"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Edited:</span>{" "}
          {auditInfo?.editedAt || "—"}{" "}
          <span className="text-muted-foreground">by</span>{" "}
          {auditInfo?.editedBy || "—"}
        </div>
      </div>
    </div>
  );
}
