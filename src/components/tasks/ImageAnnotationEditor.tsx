import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ArrowRight, Square, Circle, Type, Pen, X, RotateCcw, Undo2, Redo2, MousePointer2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import type {
  Annotation,
  AnnotationColor,
  AnnotationLineStyle,
  AnnotationStrokeWidth,
  TextAnnotation,
} from "@/types/image-annotations";
import {
  getColorHex,
  getStrokeWidthPx,
  getLineDash,
  getTextHighlightFill,
  ANNOTATION_COLORS,
  TEXT_SIZE_PTS,
  DEFAULT_FONT_SIZE_PT,
  SELECTION_TEAL,
} from "@/utils/annotation-colors";
import { measureTextFrame } from "@/utils/annotation-text";

/** Passive overlay for AI-detected objects (read-only, dashed boxes) */
export interface DetectionOverlay {
  type: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  confidence?: number;
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  imageId: string;
  taskId: string; // Can be empty string for temp images
  initialAnnotations?: Annotation[];
  editSessions?: Array<{
    id: string;
    createdAt: string;
    userId: string | null;
    userDisplayName: string;
    userAvatarUrl: string | null;
    versionNumber: number;
    label: string;
    annotations: Annotation[];
  }>;
  detectionOverlays?: DetectionOverlay[];
  onSave: (annotations: Annotation[], isAutosave?: boolean) => Promise<void>;
  onCancel: () => void;
}

type ToolType = "select" | "arrow" | "rect" | "circle" | "text" | "freedraw";
type ShapeHandle = "from" | "to" | "nw" | "ne" | "se" | "sw";

// Default sizes (relative 0-1)
const DEFAULT_SIZES = {
  pin: { radius: 0.02 },
  arrow: { length: 0.15 },
  rect: { width: 0.2, height: 0.15 },
  circle: { radius: 0.08 },
  text: { width: 0.25, height: 0.1 },
};

export function ImageAnnotationEditor({
  imageUrl,
  imageId,
  taskId,
  initialAnnotations = [],
  editSessions = [],
  detectionOverlays = [],
  onSave,
  onCancel,
}: ImageAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>("select");
  const [imageSize, setImageSize] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>("charcoal");
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<AnnotationStrokeWidth>("medium");
  const [selectedLineStyle, setSelectedLineStyle] = useState<AnnotationLineStyle>("solid");
  const [selectedFontSizePt, setSelectedFontSizePt] = useState<number>(DEFAULT_FONT_SIZE_PT);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<ShapeHandle | null>(null);
  const [inlineTextEditor, setInlineTextEditor] = useState<{
    annotationId: string;
    text: string;
    x: number;
    y: number;
    width: number;
    fontSizePt: number;
    textColor: AnnotationColor;
  } | null>(null);
  const inlineInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingTextClickRef = useRef<{
    annotationId: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const pointerSessionRef = useRef(false);
  const isDrawingRef = useRef(false);
  const isMobile = useIsMobile();
  
  // Track drawing state for click-and-drag tools
  const [isDrawing, setIsDrawing] = useState(false);
  const pointerMoveRef = useRef<(x: number, y: number) => void>(() => {});
  const pointerEndRef = useRef<() => void>(() => {});
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  
  // Undo/redo stack
  const [history, setHistory] = useState<Annotation[][]>([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Autosave state
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAnnotations, setLastSavedAnnotations] = useState<Annotation[]>(initialAnnotations);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const [visibleSessionIds, setVisibleSessionIds] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Track if annotations have changed
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(annotations) !== JSON.stringify(lastSavedAnnotations);
  }, [annotations, lastSavedAnnotations]);

  // Always render the live edit buffer. History versions can be loaded into it via the layer list.
  const displayAnnotations = annotations;

  const canEditAnnotation = useCallback(
    (annotation: Annotation) => {
      if (!currentUserId) return true;
      if (annotation.createdBy && annotation.createdBy !== currentUserId) return false;
      const activeSession = editSessions.find((s) => s.id === activeSessionId);
      if (activeSession?.userId && activeSession.userId !== currentUserId) return false;
      return true;
    },
    [activeSessionId, currentUserId, editSessions],
  );

  const getFrameCorners = (annotation: Annotation): Array<{ handle: ShapeHandle; x: number; y: number }> => {
    if (!imageSize) return [];
    if (annotation.type === "text") {
      const ctx = canvasRef.current?.getContext("2d") ?? document.createElement("canvas").getContext("2d");
      if (!ctx) return [];
      const frame = measureTextFrame(ctx, annotation, imageSize.width, imageSize.height);
      return [
        { handle: "nw", x: frame.x, y: frame.y },
        { handle: "ne", x: frame.x + frame.width, y: frame.y },
        { handle: "se", x: frame.x + frame.width, y: frame.y + frame.height },
        { handle: "sw", x: frame.x, y: frame.y + frame.height },
      ];
    }
    if (annotation.type === "rect") {
      const x = annotation.x * imageSize.width;
      const y = annotation.y * imageSize.height;
      const width = annotation.width * imageSize.width;
      const height = annotation.height * imageSize.height;
      return [
        { handle: "nw", x, y },
        { handle: "ne", x: x + width, y },
        { handle: "se", x: x + width, y: y + height },
        { handle: "sw", x, y: y + height },
      ];
    }
    if (annotation.type === "circle") {
      const x = annotation.x * imageSize.width;
      const y = annotation.y * imageSize.height;
      const radius = annotation.radius * Math.min(imageSize.width, imageSize.height);
      return [
        { handle: "ne", x: x + radius, y },
        { handle: "se", x, y: y + radius },
        { handle: "sw", x: x - radius, y },
        { handle: "nw", x, y: y - radius },
      ];
    }
    if (annotation.type === "arrow") {
      return [
        { handle: "from", x: annotation.from.x * imageSize.width, y: annotation.from.y * imageSize.height },
        { handle: "to", x: annotation.to.x * imageSize.width, y: annotation.to.y * imageSize.height },
      ];
    }
    return [];
  };

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    if (!imageSize) return;

    ctx.fillStyle = SELECTION_TEAL;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    const handleSize = 7;
    const corners = getFrameCorners(annotation);

    if (annotation.type === "text" || annotation.type === "rect") {
      const [nw, , se] = corners;
      if (nw && se) {
        ctx.strokeStyle = SELECTION_TEAL;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
      }
    }

    ctx.fillStyle = SELECTION_TEAL;
    ctx.strokeStyle = "#FFFFFF";
    corners.forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.arc(x, y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  };

  const getHandleAtPoint = (clientX: number, clientY: number, target?: Annotation): ShapeHandle | null => {
    if (!imageSize || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const handleRadius = 14;
    const annotation = target ?? annotations.find((a) => a.annotationId === selectedAnnotationId);
    if (!annotation) return null;
    const corners = getFrameCorners(annotation);
    for (const corner of corners) {
      if (Math.sqrt((canvasX - corner.x) ** 2 + (canvasY - corner.y) ** 2) <= handleRadius) {
        return corner.handle;
      }
    }
    return null;
  };

  const drawOneAnnotation = (
    ctx: CanvasRenderingContext2D,
    annotation: Annotation,
    options?: { hideText?: boolean },
  ) => {
    if (!imageSize) return;
    const strokeColor = getColorHex(annotation.strokeColor);
    const strokeWidth = getStrokeWidthPx(annotation.strokeWidth);
    const dash = getLineDash(annotation.lineStyle, strokeWidth);
    const x = annotation.x * imageSize.width;
    const y = annotation.y * imageSize.height;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dash);
    ctx.shadowBlur = 0;

    switch (annotation.type) {
      case "pin":
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "arrow": {
        const fromX = annotation.from.x * imageSize.width;
        const fromY = annotation.from.y * imageSize.height;
        const toX = annotation.to.x * imageSize.width;
        const toY = annotation.to.y * imageSize.height;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.setLineDash([]);
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowLength = 11 + strokeWidth;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - arrowLength * Math.cos(angle - Math.PI / 6),
          toY - arrowLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - arrowLength * Math.cos(angle + Math.PI / 6),
          toY - arrowLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
        break;
      }
      case "rect": {
        const rectWidth = annotation.width * imageSize.width;
        const rectHeight = annotation.height * imageSize.height;
        if (annotation.fillColor && annotation.fillColor !== "transparent") {
          ctx.fillStyle = getColorHex(annotation.fillColor);
          ctx.fillRect(x, y, rectWidth, rectHeight);
        }
        ctx.strokeRect(x, y, rectWidth, rectHeight);
        break;
      }
      case "circle": {
        const radius = annotation.radius * Math.min(imageSize.width, imageSize.height);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (annotation.fillColor && annotation.fillColor !== "transparent") {
          ctx.fillStyle = getColorHex(annotation.fillColor);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }
      case "text": {
        if (options?.hideText) break;
        const frame = measureTextFrame(ctx, annotation, imageSize.width, imageSize.height);
        const pad = 4;
        ctx.setLineDash([]);
        ctx.fillStyle = getTextHighlightFill(annotation.textColor);
        ctx.fillRect(frame.x - pad, frame.y - pad, frame.width + pad * 2, frame.height + pad * 2);
        ctx.font = `${frame.fontSize}px "Inter Tight", sans-serif`;
        ctx.fillStyle = getColorHex(annotation.textColor);
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        frame.lines.forEach((line, index) => {
          ctx.fillText(line, frame.x, frame.y + index * frame.fontSize * 1.3);
        });
        break;
      }
      case "freedraw":
        if (annotation.points && annotation.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(
            annotation.points[0].x * imageSize.width,
            annotation.points[0].y * imageSize.height,
          );
          for (let i = 1; i < annotation.points.length; i++) {
            ctx.lineTo(
              annotation.points[i].x * imageSize.width,
              annotation.points[i].y * imageSize.height,
            );
          }
          ctx.stroke();
        }
        break;
    }
    ctx.restore();
  };

  const drawAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!imageSize) return;
    try {
      displayAnnotations.forEach((annotation) => {
        const isEditing = inlineTextEditor?.annotationId === annotation.annotationId;
        drawOneAnnotation(ctx, annotation, { hideText: isEditing });
        if (annotation.annotationId === selectedAnnotationId) {
          drawSelectionHandles(ctx, annotation);
        }
      });
      if (tempAnnotation) {
        drawOneAnnotation(ctx, tempAnnotation);
      }
    } catch (error) {
      console.error("Error in drawAnnotations:", error);
    }
  }, [displayAnnotations, selectedAnnotationId, imageSize, tempAnnotation, inlineTextEditor]);

  // Draw detection overlays (read-only, dashed boxes) — separate from user annotations
  const drawDetectionOverlays = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!imageSize || detectionOverlays.length === 0) return;

      ctx.save();
      ctx.strokeStyle = "#8EC9CE"; // Primary teal from design system
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.font = "12px Inter Tight, sans-serif";
      ctx.fillStyle = "rgba(142, 201, 206, 0.9)";

      for (const overlay of detectionOverlays) {
        const x = overlay.x * imageSize.width;
        const y = overlay.y * imageSize.height;
        const w = (overlay.width ?? 0.15) * imageSize.width;
        const h = (overlay.height ?? 0.1) * imageSize.height;

        ctx.strokeRect(x, y, w, h);
        if (overlay.label) {
          ctx.fillRect(x, y - 18, Math.min(ctx.measureText(overlay.label).width + 8, w), 18);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillText(overlay.label, x + 4, y - 4);
          ctx.fillStyle = "rgba(142, 201, 206, 0.9)";
        }
      }

      ctx.restore();
    },
    [imageSize, detectionOverlays]
  );

  // Define drawCanvas (uses drawAnnotations + drawDetectionOverlays)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imageElement = imageElementRef.current;
    if (!imageElement) return;
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    drawAnnotations(ctx);
    drawDetectionOverlays(ctx);
  }, [imageSize, drawAnnotations, drawDetectionOverlays, annotations.length, currentTool, tempAnnotation?.type]);

  // Load image and set up canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current;
        // Set reasonable max dimensions: 90vw width, 85vh height (accounting for toolbar/buttons)
        const maxWidth = Math.min(container.clientWidth - 32, window.innerWidth * 0.9);
        const maxHeight = Math.min(container.clientHeight - 120, window.innerHeight * 0.85);
        
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const width = img.width * scale;
        const height = img.height * scale;
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        setImageSize({ 
          width, 
          height, 
          naturalWidth: img.width, 
          naturalHeight: img.height 
        });
        imageElementRef.current = img;
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Redraw canvas when annotations change or image size is set
  useEffect(() => {
    if (imageSize) {
      try {
        drawCanvas();
      } catch (error) {
        console.error("Error drawing canvas:", error);
      }
    }
  }, [annotations, selectedAnnotationId, imageSize, tempAnnotation, detectionOverlays, drawCanvas]);

  // Add to history when annotations change (for undo/redo)
  // Skip initial render and only track user changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Don't add to history if it's the same as current
    const currentJson = JSON.stringify(annotations);
    const lastJson = JSON.stringify(history[historyIndex]);
    if (currentJson !== lastJson) {
      // Remove any future history if we're not at the end
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(annotations))); // Deep copy
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations]);

  // Handle autosave
  const handleAutosave = useCallback(async () => {
    const currentAnnotations = annotations;
    const currentJson = JSON.stringify(currentAnnotations);
    const savedJson = JSON.stringify(lastSavedAnnotations);
    
    if (currentJson === savedJson || currentAnnotations.length === 0) {
      return;
    }
    if (isDrawingRef.current) return;

    setAutosaveStatus('saving');
    try {
      await onSave(currentAnnotations, true);
      
      setLastSavedAnnotations(currentAnnotations);
      setAutosaveStatus('saved');
      
      // Reset to idle after 1 second
      setTimeout(() => {
        setAutosaveStatus('idle');
      }, 1000);
    } catch (error) {
      console.error("Autosave failed:", error);
      setAutosaveStatus('idle');
    }
  }, [annotations, lastSavedAnnotations, onSave]);

  // Autosave timer (2 seconds)
  useEffect(() => {
    if (!hasUnsavedChanges || annotations.length === 0 || isInitialMount.current) return;
    if (isDrawing || inlineTextEditor) return;

    const timer = setTimeout(() => {
      handleAutosave();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [annotations, hasUnsavedChanges, handleAutosave, isDrawing, inlineTextEditor]);

  // Undo/redo functions
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
      setSelectedAnnotationId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
      setSelectedAnnotationId(null);
    }
  }, [history, historyIndex]);

  const handleReset = useCallback(() => {
    if (confirm("Reset all annotations to original state?")) {
      setAnnotations(initialAnnotations);
      setHistory([initialAnnotations]);
      setHistoryIndex(0);
      setLastSavedAnnotations(initialAnnotations);
      setSelectedAnnotationId(null);
    }
  }, [initialAnnotations]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm(
        "You have unsaved annotations. Close without saving?"
      );
      if (!shouldDiscard) return;
    }
    onCancel();
  }, [hasUnsavedChanges, onCancel]);

  const loadSession = useCallback(
    (sessionId: string) => {
      const session = editSessions.find((s) => s.id === sessionId);
      if (!session) return;
      if (hasUnsavedChanges) {
        const ok = window.confirm("Replace current annotations with this version? Unsaved changes will be lost.");
        if (!ok) return;
      }
      const next = JSON.parse(JSON.stringify(session.annotations)) as Annotation[];
      setAnnotations(next);
      setHistory([next]);
      setHistoryIndex(0);
      setLastSavedAnnotations(next);
      setSelectedAnnotationId(null);
      setVisibleSessionIds([sessionId]);
      setActiveSessionId(sessionId);
    },
    [editSessions, hasUnsavedChanges]
  );

  const getRelativeCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!canvasRef.current || !imageSize) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / imageSize.width;
    const y = (clientY - rect.top) / imageSize.height;
    return { 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    };
  };

  const startInlineTextEditing = useCallback((annotationId: string) => {
    const textAnnotation = annotations.find(
      (ann): ann is TextAnnotation =>
        ann.annotationId === annotationId && ann.type === "text"
    );
    if (!textAnnotation || !canEditAnnotation(textAnnotation)) return;
    setInlineTextEditor({
      annotationId: textAnnotation.annotationId,
      text: textAnnotation.text,
      x: textAnnotation.x,
      y: textAnnotation.y,
      width: textAnnotation.width,
      fontSizePt: textAnnotation.fontSizePt ?? DEFAULT_FONT_SIZE_PT,
      textColor: textAnnotation.textColor,
    });
    setSelectedFontSizePt(textAnnotation.fontSizePt ?? DEFAULT_FONT_SIZE_PT);
    setSelectedColor(textAnnotation.textColor);
  }, [annotations, canEditAnnotation]);

  const commitInlineTextEditing = useCallback(() => {
    if (!inlineTextEditor) return;
    const trimmedText = inlineTextEditor.text.trim();
    setAnnotations((prev) => {
      if (!trimmedText) {
        return prev.filter((ann) => ann.annotationId !== inlineTextEditor.annotationId);
      }
      return prev.map((ann) =>
        ann.annotationId === inlineTextEditor.annotationId && ann.type === "text"
          ? { ...ann, text: inlineTextEditor.text, width: inlineTextEditor.width, fontSizePt: inlineTextEditor.fontSizePt }
          : ann
      );
    });
    if (!trimmedText) {
      setSelectedAnnotationId((prev) => (prev === inlineTextEditor.annotationId ? null : prev));
    }
    setInlineTextEditor(null);
  }, [inlineTextEditor]);

  const cancelInlineTextEditing = useCallback(() => {
    if (!inlineTextEditor) return;
    setAnnotations((prev) =>
      prev.filter((ann) => {
        if (ann.annotationId !== inlineTextEditor.annotationId) return true;
        return ann.type !== "text" || ann.text.trim().length > 0;
      })
    );
    setSelectedAnnotationId((prev) => (prev === inlineTextEditor.annotationId ? null : prev));
    setInlineTextEditor(null);
  }, [inlineTextEditor]);

  const getInlineEditorPosition = useCallback(() => {
    if (!inlineTextEditor || !canvasRef.current || !containerRef.current || !imageSize) return null;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const widthPx = Math.max(48, inlineTextEditor.width * imageSize.width);
    const ctx = canvasRef.current.getContext("2d");
    const fontSize = ctx
      ? measureTextFrame(
          ctx,
          {
            ...inlineTextEditor,
            type: "text",
            annotationId: inlineTextEditor.annotationId,
            version: 1,
            strokeColor: inlineTextEditor.textColor,
            strokeWidth: "medium",
            background: "none",
          } as TextAnnotation,
          imageSize.width,
          imageSize.height,
        ).fontSize
      : inlineTextEditor.fontSizePt;
    return {
      left: canvasRect.left - containerRect.left + inlineTextEditor.x * imageSize.width,
      top: canvasRect.top - containerRect.top + inlineTextEditor.y * imageSize.height,
      width: widthPx,
      fontSize,
    };
  }, [inlineTextEditor, imageSize]);

  const getAnnotationAtPoint = (x: number, y: number, hitArea: number = 15): Annotation | null => {
    if (!imageSize || !canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    // Check annotations in reverse order (top-most first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      const annX = ann.x * imageSize.width;
      const annY = ann.y * imageSize.height;

      switch (ann.type) {
        case "pin":
          const pinDist = Math.sqrt(
            Math.pow(canvasX - annX, 2) + Math.pow(canvasY - annY, 2)
          );
          if (pinDist < hitArea) return ann;
          break;

        case "rect":
          const rectWidth = ann.width * imageSize.width;
          const rectHeight = ann.height * imageSize.height;
          if (
            canvasX >= annX &&
            canvasX <= annX + rectWidth &&
            canvasY >= annY &&
            canvasY <= annY + rectHeight
          ) {
            return ann;
          }
          break;

        case "circle":
          const radius = ann.radius * Math.min(imageSize.width, imageSize.height);
          const circleDist = Math.sqrt(
            Math.pow(canvasX - annX, 2) + Math.pow(canvasY - annY, 2)
          );
          if (circleDist <= radius) return ann;
          break;

        case "arrow":
          const fromX = ann.from.x * imageSize.width;
          const fromY = ann.from.y * imageSize.height;
          const toX = ann.to.x * imageSize.width;
          const toY = ann.to.y * imageSize.height;
          // Check if point is near line
          const distToLine = Math.abs(
            ((toY - fromY) * canvasX - (toX - fromX) * canvasY + toX * fromY - toY * fromX) /
            Math.sqrt(Math.pow(toY - fromY, 2) + Math.pow(toX - fromX, 2))
          );
          if (distToLine < hitArea) {
            // Check if within line segment bounds
            const minX = Math.min(fromX, toX) - hitArea;
            const maxX = Math.max(fromX, toX) + hitArea;
            const minY = Math.min(fromY, toY) - hitArea;
            const maxY = Math.max(fromY, toY) + hitArea;
            if (canvasX >= minX && canvasX <= maxX && canvasY >= minY && canvasY <= maxY) {
              return ann;
            }
          }
          break;

        case "text": {
          const ctx = canvasRef.current.getContext("2d");
          const frame = ctx
            ? measureTextFrame(ctx, ann, imageSize.width, imageSize.height)
            : {
                x: annX,
                y: annY,
                width: ann.width * imageSize.width,
                height: 40,
              };
          if (
            canvasX >= frame.x - 4 &&
            canvasX <= frame.x + frame.width + 4 &&
            canvasY >= frame.y - 4 &&
            canvasY <= frame.y + frame.height + 4
          ) {
            return ann;
          }
          break;
        }

        case "freedraw":
          if (ann.points && ann.points.length >= 2) {
            for (let i = 0; i < ann.points.length - 1; i++) {
              const p1x = ann.points[i].x * imageSize.width;
              const p1y = ann.points[i].y * imageSize.height;
              const p2x = ann.points[i + 1].x * imageSize.width;
              const p2y = ann.points[i + 1].y * imageSize.height;
              const dx = p2x - p1x;
              const dy = p2y - p1y;
              const segLenSq = dx * dx + dy * dy || 1;
              const t = Math.max(0, Math.min(1, ((canvasX - p1x) * dx + (canvasY - p1y) * dy) / segLenSq));
              const projX = p1x + t * dx;
              const projY = p1y + t * dy;
              const dist = Math.sqrt((canvasX - projX) ** 2 + (canvasY - projY) ** 2);
              if (dist < hitArea) return ann;
            }
          }
          break;
      }
    }
    return null;
  };

  const handlePointerStart = (clientX: number, clientY: number) => {
    if (!imageSize) return;
    pointerSessionRef.current = true;
    pendingTextClickRef.current = null;

    const hitArea = isMobile ? 20 : 15;
    const coords = getRelativeCoords(clientX, clientY);
    if (!coords) return;

    const selected = annotations.find((a) => a.annotationId === selectedAnnotationId);
    if (selected && currentTool === "select") {
      const handle = getHandleAtPoint(clientX, clientY, selected);
      if (handle) {
        if (inlineTextEditor) commitInlineTextEditing();
        setDraggingHandle(handle);
        return;
      }
    }

    const clickedAnnotation = currentTool === "select" || currentTool === "text"
      ? getAnnotationAtPoint(clientX, clientY, hitArea)
      : null;

    if (currentTool === "select") {
      if (inlineTextEditor && inlineTextEditor.annotationId !== clickedAnnotation?.annotationId) {
        commitInlineTextEditing();
      }
      if (!clickedAnnotation) {
        setSelectedAnnotationId(null);
        return;
      }
      setSelectedAnnotationId(clickedAnnotation.annotationId);
      if (clickedAnnotation.type === "text") {
        setSelectedColor(clickedAnnotation.textColor);
        setSelectedFontSizePt(clickedAnnotation.fontSizePt ?? DEFAULT_FONT_SIZE_PT);
      } else {
        setSelectedColor(clickedAnnotation.strokeColor);
        setSelectedStrokeWidth(clickedAnnotation.strokeWidth);
        setSelectedLineStyle(clickedAnnotation.lineStyle ?? "solid");
      }
      const handle = getHandleAtPoint(clientX, clientY, clickedAnnotation);
      if (handle) {
        setDraggingHandle(handle);
        return;
      }
      if (clickedAnnotation.type === "text" && canEditAnnotation(clickedAnnotation)) {
        pendingTextClickRef.current = {
          annotationId: clickedAnnotation.annotationId,
          clientX,
          clientY,
        };
        return;
      }
      setIsDragging(true);
      setDragOffset({
        x: coords.x - clickedAnnotation.x,
        y: coords.y - clickedAnnotation.y,
      });
      return;
    }

    if (currentTool === "text" && clickedAnnotation?.type === "text" && canEditAnnotation(clickedAnnotation)) {
      if (inlineTextEditor && inlineTextEditor.annotationId !== clickedAnnotation.annotationId) {
        commitInlineTextEditing();
      }
      setSelectedAnnotationId(clickedAnnotation.annotationId);
      startInlineTextEditing(clickedAnnotation.annotationId);
      return;
    }

    if (inlineTextEditor) commitInlineTextEditing();

    if (currentTool === "text") {
      const newAnnotation: TextAnnotation = {
        annotationId: crypto.randomUUID(),
        version: 1,
        type: "text",
        x: coords.x,
        y: coords.y,
        width: DEFAULT_SIZES.text.width,
        text: "",
        textColor: selectedColor,
        background: "none",
        strokeColor: selectedColor,
        strokeWidth: selectedStrokeWidth,
        fontSizePt: selectedFontSizePt,
        createdBy: currentUserId ?? undefined,
      };
      setAnnotations([...annotations, newAnnotation]);
      setSelectedAnnotationId(newAnnotation.annotationId);
      setInlineTextEditor({
        annotationId: newAnnotation.annotationId,
        text: "",
        x: coords.x,
        y: coords.y,
        width: newAnnotation.width,
        fontSizePt: selectedFontSizePt,
        textColor: selectedColor,
      });
      return;
    }

    if (currentTool === "freedraw") {
      isDrawingRef.current = true;
      setIsDrawing(true);
      const temp: Annotation = {
        annotationId: crypto.randomUUID(),
        version: 1,
        type: "freedraw",
        x: coords.x,
        y: coords.y,
        strokeColor: selectedColor,
        strokeWidth: selectedStrokeWidth,
        lineStyle: selectedLineStyle,
        createdBy: currentUserId ?? undefined,
        points: [{ x: coords.x, y: coords.y }],
      };
      setTempAnnotation(temp);
      return;
    }

    isDrawingRef.current = true;
    setIsDrawing(true);
    setDrawStart(coords);
    const temp: Annotation = {
      annotationId: crypto.randomUUID(),
      version: 1,
      type: currentTool,
      x: coords.x,
      y: coords.y,
      strokeColor: selectedColor,
      strokeWidth: selectedStrokeWidth,
      lineStyle: selectedLineStyle,
      createdBy: currentUserId ?? undefined,
      ...(currentTool === "arrow" && { from: coords, to: coords }),
      ...(currentTool === "rect" && { width: 0, height: 0 }),
      ...(currentTool === "circle" && { radius: 0 }),
    } as Annotation;
    setTempAnnotation(temp);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const clickedAnnotation = getAnnotationAtPoint(e.clientX, e.clientY, isMobile ? 22 : 16);
    if (clickedAnnotation?.type === "text" && canEditAnnotation(clickedAnnotation)) {
      setSelectedAnnotationId(clickedAnnotation.annotationId);
      startInlineTextEditing(clickedAnnotation.annotationId);
    }
  };

  const resizeSelectedAnnotation = (ann: Annotation, handle: ShapeHandle, coords: { x: number; y: number }): Annotation => {
    if (!imageSize) return ann;
    const nx = Math.max(0, Math.min(1, coords.x));
    const ny = Math.max(0, Math.min(1, coords.y));

    if (ann.type === "arrow" && (handle === "from" || handle === "to")) {
      const newFrom = handle === "from" ? { x: nx, y: ny } : ann.from;
      const newTo = handle === "to" ? { x: nx, y: ny } : ann.to;
      return {
        ...ann,
        from: newFrom,
        to: newTo,
        x: (newFrom.x + newTo.x) / 2,
        y: (newFrom.y + newTo.y) / 2,
      };
    }

    if (ann.type === "circle") {
      const dx = nx - ann.x;
      const dy = ny - ann.y;
      return { ...ann, radius: Math.max(0.02, Math.sqrt(dx * dx + dy * dy)) };
    }

    if (ann.type === "rect" || ann.type === "text") {
      const right = ann.x + (ann.type === "rect" ? ann.width : ann.width);
      const bottom = ann.type === "rect"
        ? ann.y + ann.height
        : ann.y + (ann.height ?? 0.08);
      let nextX = ann.x;
      let nextY = ann.y;
      let nextRight = right;
      let nextBottom = bottom;
      if (handle === "nw" || handle === "sw") nextX = nx;
      if (handle === "ne" || handle === "se") nextRight = nx;
      if (handle === "nw" || handle === "ne") nextY = ny;
      if (handle === "sw" || handle === "se") nextBottom = ny;
      const width = Math.max(0.04, nextRight - nextX);
      const height = Math.max(0.03, nextBottom - nextY);
      if (ann.type === "text") {
        return { ...ann, x: nextX, y: nextY, width, height };
      }
      return { ...ann, x: nextX, y: nextY, width, height };
    }

    return ann;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!imageSize) return;
    
    const coords = getRelativeCoords(clientX, clientY);
    if (!coords) return;

    if (pendingTextClickRef.current) {
      const dx = clientX - pendingTextClickRef.current.clientX;
      const dy = clientY - pendingTextClickRef.current.clientY;
      if (Math.sqrt(dx * dx + dy * dy) > 6) {
        const ann = annotations.find((a) => a.annotationId === pendingTextClickRef.current?.annotationId);
        if (ann) {
          setIsDragging(true);
          setDragOffset({
            x: coords.x - ann.x,
            y: coords.y - ann.y,
          });
        }
        pendingTextClickRef.current = null;
      } else {
        return;
      }
    }

    if (draggingHandle && selectedAnnotationId) {
      setAnnotations(
        annotations.map((ann) => {
          if (ann.annotationId !== selectedAnnotationId) return ann;
          return resizeSelectedAnnotation(ann, draggingHandle, coords);
        })
      );
      const selected = annotations.find((a) => a.annotationId === selectedAnnotationId);
      if (selected?.type === "text" && inlineTextEditor?.annotationId === selected.annotationId) {
        const next = resizeSelectedAnnotation(selected, draggingHandle, coords);
        if (next.type === "text") {
          setInlineTextEditor((prev) =>
            prev ? { ...prev, x: next.x, y: next.y, width: next.width } : prev
          );
        }
      }
      return;
    }

    // Freedraw: add points to path
    if (isDrawing && tempAnnotation?.type === "freedraw") {
      setTempAnnotation({
        ...tempAnnotation,
        points: [...tempAnnotation.points, { x: coords.x, y: coords.y }],
      });
      return;
    }

    // Handle drawing new annotation (arrow, rect, circle - click-and-drag)
    if (isDrawing && drawStart && tempAnnotation && tempAnnotation.type !== "freedraw") {
      const dx = coords.x - drawStart.x;
      const dy = coords.y - drawStart.y;
      
      const updated: Annotation = {
        ...tempAnnotation,
        ...(tempAnnotation.type === "arrow" && { to: coords }),
        ...(tempAnnotation.type === "rect" && {
          width: Math.abs(dx),
          height: Math.abs(dy),
          x: dx < 0 ? coords.x : drawStart.x,
          y: dy < 0 ? coords.y : drawStart.y,
        }),
        ...(tempAnnotation.type === "circle" && {
          radius: Math.sqrt(dx * dx + dy * dy),
        }),
      } as Annotation;
      
      setTempAnnotation(updated);
      return;
    }
    
    // Handle dragging existing annotation (whole shape - including arrow)
    if (isDragging && selectedAnnotationId && dragOffset) {
      setAnnotations(
        annotations.map((ann) => {
          if (ann.annotationId !== selectedAnnotationId) return ann;
          const newX = Math.max(0, Math.min(1, coords.x - dragOffset.x));
          const newY = Math.max(0, Math.min(1, coords.y - dragOffset.y));
          if (ann.type === "arrow") {
            const deltaX = newX - ann.x;
            const deltaY = newY - ann.y;
            return {
              ...ann,
              x: newX,
              y: newY,
              from: { x: ann.from.x + deltaX, y: ann.from.y + deltaY },
              to: { x: ann.to.x + deltaX, y: ann.to.y + deltaY },
            };
          }
          if (ann.type === "freedraw" && ann.points?.length) {
            const deltaX = newX - ann.x;
            const deltaY = newY - ann.y;
            return {
              ...ann,
              x: newX,
              y: newY,
              points: ann.points.map((p) => ({ x: p.x + deltaX, y: p.y + deltaY })),
            };
          }
          return { ...ann, x: newX, y: newY };
        })
      );
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handlePointerStart(e.clientX, e.clientY);
  };
  
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      handlePointerStart(touch.clientX, touch.clientY);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handlePointerMove(e.clientX, e.clientY);
  };
  
  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      handlePointerMove(touch.clientX, touch.clientY);
    }
  };

  const handlePointerEnd = () => {
    if (!pointerSessionRef.current && !isDrawingRef.current && !pendingTextClickRef.current) {
      return;
    }
    pointerSessionRef.current = false;

    if (pendingTextClickRef.current) {
      const { annotationId } = pendingTextClickRef.current;
      pendingTextClickRef.current = null;
      startInlineTextEditing(annotationId);
    }
    setDraggingHandle(null);

    if (isDrawingRef.current && tempAnnotation) {
      isDrawingRef.current = false;
      let next = tempAnnotation;
      const hasSize =
        (tempAnnotation.type === "arrow" && tempAnnotation.to && (Math.abs(tempAnnotation.to.x - tempAnnotation.from.x) > 0.008 || Math.abs(tempAnnotation.to.y - tempAnnotation.from.y) > 0.008)) ||
        (tempAnnotation.type === "rect" && (tempAnnotation.width || 0) > 0.01 && (tempAnnotation.height || 0) > 0.01) ||
        (tempAnnotation.type === "circle" && (tempAnnotation.radius || 0) > 0.01) ||
        (tempAnnotation.type === "freedraw" && tempAnnotation.points && tempAnnotation.points.length >= 2);

      if (!hasSize && tempAnnotation.type === "arrow") {
        next = {
          ...tempAnnotation,
          to: {
            x: Math.min(1, tempAnnotation.x + DEFAULT_SIZES.arrow.length),
            y: tempAnnotation.y,
          },
        };
      } else if (!hasSize && tempAnnotation.type === "rect") {
        next = {
          ...tempAnnotation,
          width: DEFAULT_SIZES.rect.width,
          height: DEFAULT_SIZES.rect.height,
        };
      } else if (!hasSize && tempAnnotation.type === "circle") {
        next = {
          ...tempAnnotation,
          radius: DEFAULT_SIZES.circle.radius,
        };
      }

      const keep =
        hasSize ||
        next.type === "arrow" ||
        next.type === "rect" ||
        next.type === "circle";

      if (keep && next.type !== "freedraw") {
        setAnnotations([...annotations, next]);
        setSelectedAnnotationId(next.annotationId);
      } else if (hasSize) {
        setAnnotations([...annotations, next]);
        setSelectedAnnotationId(next.annotationId);
      }

      setIsDrawing(false);
      setDrawStart(null);
      setTempAnnotation(null);
    }
    
    setIsDragging(false);
    setDragOffset(null);
  };

  pointerMoveRef.current = handlePointerMove;
  pointerEndRef.current = handlePointerEnd;

  useEffect(() => {
    const active = isDrawing || isDragging || Boolean(draggingHandle);
    if (!active) return;
    const onMove = (event: PointerEvent) => {
      pointerMoveRef.current(event.clientX, event.clientY);
    };
    const onUp = () => {
      pointerEndRef.current();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDrawing, isDragging, draggingHandle]);

  const handleDelete = () => {
    if (selectedAnnotationId) {
      setAnnotations(annotations.filter((a) => a.annotationId !== selectedAnnotationId));
      if (inlineTextEditor?.annotationId === selectedAnnotationId) {
        setInlineTextEditor(null);
      }
      setSelectedAnnotationId(null);
    }
  };

  const handleSave = async (): Promise<"saved" | "unchanged" | "failed"> => {
    setIsSaving(true);
    setAutosaveStatus('saving');
    try {
      const annotationsForSave = inlineTextEditor
        ? annotations
            .map((ann) =>
              ann.annotationId === inlineTextEditor.annotationId && ann.type === "text"
                ? { ...ann, text: inlineTextEditor.text }
                : ann
            )
            .filter((ann) => ann.type !== "text" || ann.text.trim().length > 0)
        : annotations;

      // Only save if changed
      if (JSON.stringify(annotationsForSave) === JSON.stringify(lastSavedAnnotations)) {
        setIsSaving(false);
        setAutosaveStatus('idle');
        return "unchanged";
      }

      await onSave(annotationsForSave, false);
      setAnnotations(annotationsForSave);
      setLastSavedAnnotations(annotationsForSave);
      setInlineTextEditor(null);
      setAutosaveStatus('saved');
      
      setTimeout(() => {
        setAutosaveStatus('idle');
      }, 1000);
      return "saved";
    } catch (error) {
      console.error("Failed to save annotations:", error);
      setAutosaveStatus('idle');
      return "failed";
    } finally {
      setIsSaving(false);
    }
  };

  const handleDone = async () => {
    if (!hasUnsavedChanges) {
      onCancel();
      return;
    }
    const result = await handleSave();
    if (result !== "failed") {
      onCancel();
    }
  };

  // Escape: clear selection → cancel text → close editor
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (inlineTextEditor) {
        cancelInlineTextEditing();
        return;
      }
      if (selectedAnnotationId) {
        setSelectedAnnotationId(null);
        return;
      }
      handleCancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleCancel, inlineTextEditor, selectedAnnotationId, cancelInlineTextEditing]);

  const selectedAnnotation = annotations.find((a) => a.annotationId === selectedAnnotationId);

  useEffect(() => {
    if (!inlineTextEditor) return;
    const frame = requestAnimationFrame(() => {
      inlineInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [inlineTextEditor?.annotationId]);

  useEffect(() => {
    if (editSessions.length === 0) return;
    const latestVersion = editSessions.find((s) => s.id !== "original");
    const originalId = editSessions.find((s) => s.id === "original")?.id;
    const nextId = latestVersion?.id ?? originalId ?? editSessions[0].id;
    setVisibleSessionIds((prev) => {
      if (prev.length > 0) return prev;
      return [nextId];
    });
    setActiveSessionId((current) => current ?? nextId);
  }, [editSessions]);

  const toolButtonClass = (active: boolean) =>
    cn(
      "flex items-center justify-center rounded-lg transition-colors",
      isMobile ? "h-11 w-11" : "h-9 w-9",
      active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
    );

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `image.${extension}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  }, [imageUrl]);

  const applyColor = (color: AnnotationColor) => {
    setSelectedColor(color);
    if (!selectedAnnotationId) return;
    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.annotationId !== selectedAnnotationId) return a;
        return a.type === "text" ? { ...a, textColor: color } : { ...a, strokeColor: color };
      })
    );
    setInlineTextEditor((prev) => (prev ? { ...prev, textColor: color } : prev));
  };

  const applyStrokeWidth = (width: AnnotationStrokeWidth) => {
    setSelectedStrokeWidth(width);
    if (!selectedAnnotationId) return;
    setAnnotations((prev) =>
      prev.map((a) => (a.annotationId === selectedAnnotationId ? { ...a, strokeWidth: width } : a))
    );
  };

  const applyLineStyle = (style: AnnotationLineStyle) => {
    setSelectedLineStyle(style);
    if (!selectedAnnotationId) return;
    setAnnotations((prev) =>
      prev.map((a) => (a.annotationId === selectedAnnotationId ? { ...a, lineStyle: style } : a))
    );
  };

  const applyFontSize = (pt: number) => {
    setSelectedFontSizePt(pt);
    if (!selectedAnnotationId) return;
    setAnnotations((prev) =>
      prev.map((a) =>
        a.annotationId === selectedAnnotationId && a.type === "text" ? { ...a, fontSizePt: pt } : a
      )
    );
    setInlineTextEditor((prev) => (prev ? { ...prev, fontSizePt: pt } : prev));
  };

  const selectTool = (tool: ToolType) => {
    if (isDrawing) {
      isDrawingRef.current = false;
      setIsDrawing(false);
      setDrawStart(null);
      setTempAnnotation(null);
    }
    if (inlineTextEditor) commitInlineTextEditing();
    setCurrentTool(tool);
    if (tool !== "select") setSelectedAnnotationId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Annotate image"
      className="modal-scrim fixed inset-0 z-[10000] flex flex-col pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      {/* Top bar — always visible exit + primary action */}
      <header
        className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md sm:px-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCancel();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">Annotate</p>
          <p className="truncate text-xs text-white/55">
            {autosaveStatus === "saving"
              ? "Saving…"
              : autosaveStatus === "saved"
                ? "Saved"
                : hasUnsavedChanges
                  ? "Unsaved changes"
                  : "Esc to close"}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDownload();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Download image"
          title="Download original image"
        >
          <Download className="h-4 w-4" />
        </button>

        <Button
          type="button"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDone();
          }}
          disabled={isSaving}
          className="shrink-0 bg-primary text-primary-foreground shadow-none"
        >
          {isSaving ? "Saving…" : hasUnsavedChanges ? "Save & close" : "Done"}
        </Button>
      </header>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
        onMouseMove={(e) => {
          if (isDrawing || isDragging || draggingHandle) {
            handlePointerMove(e.clientX, e.clientY);
          }
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={(e) => {
            e.stopPropagation();
            handlePointerEnd();
          }}
          onDoubleClick={handleCanvasDoubleClick}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePointerEnd();
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePointerEnd();
          }}
          className={cn(
            "max-h-full max-w-full rounded-md shadow-lg",
            inlineTextEditor
              ? "cursor-text"
              : currentTool === "select"
                ? "cursor-default"
                : "cursor-crosshair"
          )}
          style={{ touchAction: "none" }}
        />
        {inlineTextEditor ? (() => {
          const pos = getInlineEditorPosition() ?? {
            left: 16,
            top: 16,
            width: 180,
            fontSize: inlineTextEditor.fontSizePt,
          };
          const highlight = getTextHighlightFill(inlineTextEditor.textColor);
          const textColor = getColorHex(inlineTextEditor.textColor);
          const frameHeight = Math.max(pos.fontSize * 1.4, (inlineTextEditor.text.split("\n").length) * pos.fontSize * 1.3);
          const handles: Array<{ handle: ShapeHandle; left: number; top: number }> = [
            { handle: "nw", left: pos.left, top: pos.top },
            { handle: "ne", left: pos.left + pos.width, top: pos.top },
            { handle: "se", left: pos.left + pos.width, top: pos.top + frameHeight },
            { handle: "sw", left: pos.left, top: pos.top + frameHeight },
          ];
          return (
            <>
            <textarea
              ref={inlineInputRef}
              value={inlineTextEditor.text}
              onChange={(e) => {
                const nextText = e.target.value;
                setInlineTextEditor((prev) => (prev ? { ...prev, text: nextText } : prev));
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitInlineTextEditing();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelInlineTextEditing();
                }
              }}
              className="absolute z-20 resize-none overflow-hidden rounded-sm border border-primary bg-transparent p-1 outline-none"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
                width: `${pos.width}px`,
                minHeight: `${frameHeight}px`,
                fontSize: `${pos.fontSize}px`,
                lineHeight: 1.3,
                color: textColor,
                caretColor: textColor,
                backgroundColor: highlight,
                fontFamily: '"Inter Tight", sans-serif',
              }}
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck
              placeholder="Type…"
            />
            {handles.map((item) => (
              <button
                key={item.handle}
                type="button"
                aria-label={`Resize ${item.handle}`}
                className="absolute z-30 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary"
                style={{
                  left: `${item.left}px`,
                  top: `${item.top}px`,
                  transform: "translate(-50%, -50%)",
                  cursor: item.handle === "nw" || item.handle === "se" ? "nwse-resize" : "nesw-resize",
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggingHandle(item.handle);
                }}
              />
            ))}
            </>
          );
        })() : null}
      </div>

      {/* Selected annotation / active tool style dock */}
      {selectedAnnotation || currentTool !== "select" ? (
        <div
          className="absolute bottom-24 left-1/2 z-20 w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-black/75 p-3 shadow-lg backdrop-blur-md sm:bottom-28"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium capitalize text-white/90">
              {selectedAnnotation?.type ?? currentTool}
            </span>
            {selectedAnnotation ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/15"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAnnotationId(null)}
                  className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Deselect"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ANNOTATION_COLORS).map(([color, hex]) => (
              <button
                key={color}
                type="button"
                onClick={() => applyColor(color as AnnotationColor)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform",
                  (selectedAnnotation
                    ? selectedAnnotation.type === "text"
                      ? selectedAnnotation.textColor
                      : selectedAnnotation.strokeColor
                    : selectedColor) === color
                    ? "scale-110 border-white"
                    : "border-transparent"
                )}
                style={{ backgroundColor: hex }}
                title={color}
              />
            ))}
          </div>
          {(selectedAnnotation?.type === "text" || currentTool === "text") ? (
            <div className="mt-2 flex items-center gap-1">
              <span className="mr-1 text-2xs uppercase tracking-wide text-white/45">Pt</span>
              {TEXT_SIZE_PTS.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFontSize(pt)}
                  className={cn(
                    "rounded-md px-1.5 py-1 text-caption tabular-nums",
                    (selectedAnnotation?.type === "text"
                      ? selectedAnnotation.fontSizePt ?? DEFAULT_FONT_SIZE_PT
                      : selectedFontSizePt) === pt
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/10 text-white/80 hover:bg-white/15"
                  )}
                >
                  {pt}
                </button>
              ))}
            </div>
          ) : null}
          {((selectedAnnotation && selectedAnnotation.type !== "text" && selectedAnnotation.type !== "pin") ||
            (currentTool !== "select" && currentTool !== "text")) ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-0.5" role="group" aria-label="Line thickness">
                {(["thin", "medium", "bold"] as AnnotationStrokeWidth[]).map((width) => {
                  const stroke = width === "thin" ? 1.25 : width === "medium" ? 2.25 : 3.5;
                  const active = (selectedAnnotation?.strokeWidth ?? selectedStrokeWidth) === width;
                  return (
                    <button
                      key={width}
                      type="button"
                      onClick={() => applyStrokeWidth(width)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                      title={width}
                      aria-label={`${width} line`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                        <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
                      </svg>
                    </button>
                  );
                })}
              </div>
              <div className="h-5 w-px bg-white/15" />
              <div className="flex items-center gap-0.5" role="group" aria-label="Line style">
                {(["solid", "dashed"] as AnnotationLineStyle[]).map((style) => {
                  const active = (selectedAnnotation?.lineStyle ?? selectedLineStyle) === style;
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => applyLineStyle(style)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                      title={style}
                      aria-label={`${style} line`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                        <line
                          x1="2"
                          y1="8"
                          x2="14"
                          y2="8"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeDasharray={style === "dashed" ? "3 2.5" : undefined}
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {editSessions.filter((session) => session.id !== "original").length > 0 ? (
        <div className="absolute bottom-24 right-3 z-20 flex max-h-[40vh] w-[min(16rem,calc(100vw-1.5rem))] flex-col gap-1 overflow-y-auto sm:bottom-28 sm:right-4">
          {editSessions
            .filter((session) => session.id !== "original")
            .map((session) => {
              const isActive = (activeSessionId ?? visibleSessionIds[0]) === session.id;
              const dateLabel = formatDistanceToNow(new Date(session.createdAt), { addSuffix: true });
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => loadSession(session.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left shadow-sm backdrop-blur-md transition-colors",
                    isActive
                      ? "bg-black/80 ring-1 ring-primary"
                      : "bg-black/55 hover:bg-black/70"
                  )}
                  title={`View ${session.userDisplayName}'s edit`}
                >
                  <UserAvatar
                    imageUrl={session.userAvatarUrl}
                    name={session.userDisplayName}
                    size={22}
                    shape="circle"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption font-medium text-white">
                      {session.userDisplayName}
                    </span>
                    <span className="block truncate text-2xs text-white/55">{dateLabel}</span>
                  </span>
                </button>
              );
            })}
        </div>
      ) : null}

      {/* Bottom tool strip */}
      <footer
        className="relative z-20 flex shrink-0 items-center justify-center gap-1 border-t border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md sm:gap-1.5 sm:px-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={handleUndo} disabled={historyIndex === 0} className={toolButtonClass(false)} title="Undo" aria-label="Undo">
          <Undo2 className={cn(isMobile ? "h-5 w-5" : "h-4 w-4", historyIndex === 0 && "opacity-40")} />
        </button>
        <button type="button" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={toolButtonClass(false)} title="Redo" aria-label="Redo">
          <Redo2 className={cn(isMobile ? "h-5 w-5" : "h-4 w-4", historyIndex >= history.length - 1 && "opacity-40")} />
        </button>
        <div className="mx-1 h-6 w-px bg-white/15" />
        <button type="button" onClick={() => selectTool("select")} className={toolButtonClass(currentTool === "select")} title="Select" aria-label="Select">
          <MousePointer2 className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        <button type="button" onClick={() => selectTool("arrow")} className={toolButtonClass(currentTool === "arrow")} title="Arrow" aria-label="Arrow">
          <ArrowRight className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        <button type="button" onClick={() => selectTool("rect")} className={toolButtonClass(currentTool === "rect")} title="Rectangle" aria-label="Rectangle">
          <Square className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        <button type="button" onClick={() => selectTool("circle")} className={toolButtonClass(currentTool === "circle")} title="Circle" aria-label="Circle">
          <Circle className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        <button type="button" onClick={() => selectTool("text")} className={toolButtonClass(currentTool === "text")} title="Text" aria-label="Text">
          <Type className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        <button type="button" onClick={() => selectTool("freedraw")} className={toolButtonClass(currentTool === "freedraw")} title="Draw" aria-label="Draw">
          <Pen className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </button>
        <div className="mx-1 h-6 w-px bg-white/15" />
        <button
          type="button"
          onClick={handleReset}
          disabled={JSON.stringify(annotations) === JSON.stringify(initialAnnotations)}
          className={toolButtonClass(false)}
          title="Reset"
          aria-label="Reset annotations"
        >
          <RotateCcw className={cn(isMobile ? "h-5 w-5" : "h-4 w-4", JSON.stringify(annotations) === JSON.stringify(initialAnnotations) && "opacity-40")} />
        </button>
      </footer>
    </div>
  );
}
