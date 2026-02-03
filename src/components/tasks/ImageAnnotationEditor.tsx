import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { SquarePen, ArrowRight, Square, Circle, Type, X, Trash2, Save, RotateCcw, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Annotation, AnnotationColor, AnnotationStrokeWidth } from "@/types/image-annotations";
import { getColorHex, getStrokeWidthPx, ANNOTATION_COLORS } from "@/utils/annotation-colors";

interface ImageAnnotationEditorProps {
  imageUrl: string;
  imageId: string;
  taskId: string; // Can be empty string for temp images
  initialAnnotations?: Annotation[];
  onSave: (annotations: Annotation[], isAutosave?: boolean) => Promise<void>;
  onCancel: () => void;
}

type ToolType = "pin" | "arrow" | "rect" | "circle" | "text" | null;

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
  onSave,
  onCancel,
}: ImageAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>("charcoal");
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<AnnotationStrokeWidth>("medium");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const isMobile = useIsMobile();
  
  // Track drawing state for click-and-drag tools
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  
  // Undo/redo stack
  const [history, setHistory] = useState<Annotation[][]>([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Autosave state
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAnnotations, setLastSavedAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  
  // Track if annotations have changed
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(annotations) !== JSON.stringify(lastSavedAnnotations);
  }, [annotations, lastSavedAnnotations]);

  // Define drawSelectionHandles first (used by drawAnnotations)
  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    if (!imageSize) return;
    
    ctx.fillStyle = "#3B82F6";
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    const handleSize = 8;
    const x = annotation.x * imageSize.width;
    const y = annotation.y * imageSize.height;

    if (annotation.type === "rect" || annotation.type === "text") {
      const width = annotation.width * imageSize.width;
      const height = annotation.type === "rect" 
        ? annotation.height * imageSize.height 
        : 24; // Approximate text height
      
      const corners = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ];
      
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else if (annotation.type === "circle") {
      const radius = annotation.radius * Math.min(imageSize.width, imageSize.height);
      // Draw handles at 4 points around circle
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      angles.forEach((angle) => {
        const cx = x + radius * Math.cos(angle);
        const cy = y + radius * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(cx, cy, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else if (annotation.type === "arrow") {
      const fromX = annotation.from.x * imageSize.width;
      const fromY = annotation.from.y * imageSize.height;
      const toX = annotation.to.x * imageSize.width;
      const toY = annotation.to.y * imageSize.height;
      
      [fromX, toX].forEach((cx, i) => {
        const cy = i === 0 ? fromY : toY;
        ctx.beginPath();
        ctx.arc(cx, cy, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else if (annotation.type === "pin") {
      ctx.beginPath();
      ctx.arc(x, y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  // Define drawAnnotations (uses drawSelectionHandles)
  const drawAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!imageSize) return;
    
    try {

    // Draw all annotations
    annotations.forEach((annotation) => {
      const isSelected = annotation.annotationId === selectedAnnotationId;
      const strokeColor = getColorHex(annotation.strokeColor);
      const strokeWidth = getStrokeWidthPx(annotation.strokeWidth);

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // Soft edges (slight blur for smoothness)
      ctx.shadowBlur = 0.5;
      ctx.shadowColor = strokeColor;

      // Dashed outline for selection
      if (isSelected) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#3B82F6"; // Blue highlight
        ctx.lineWidth = strokeWidth + 1;
      } else {
        ctx.setLineDash([]);
      }

      const x = annotation.x * imageSize.width;
      const y = annotation.y * imageSize.height;

      switch (annotation.type) {
        case "pin":
          // Pin as small filled circle
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          // Reset shadow for handles
          ctx.shadowBlur = 0;
          break;

        case "arrow":
          const fromX = annotation.from.x * imageSize.width;
          const fromY = annotation.from.y * imageSize.height;
          const toX = annotation.to.x * imageSize.width;
          const toY = annotation.to.y * imageSize.height;
          
          // Draw arrow line
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();
          
          // Draw arrowhead
          const angle = Math.atan2(toY - fromY, toX - fromX);
          const arrowLength = 12;
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(
            toX - arrowLength * Math.cos(angle - Math.PI / 6),
            toY - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(toX, toY);
          ctx.lineTo(
            toX - arrowLength * Math.cos(angle + Math.PI / 6),
            toY - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
          ctx.shadowBlur = 0;
          break;

        case "rect":
          const rectWidth = annotation.width * imageSize.width;
          const rectHeight = annotation.height * imageSize.height;
          if (annotation.fillColor && annotation.fillColor !== "transparent") {
            ctx.fillStyle = getColorHex(annotation.fillColor);
            ctx.fillRect(x, y, rectWidth, rectHeight);
          }
          ctx.strokeRect(x, y, rectWidth, rectHeight);
          ctx.shadowBlur = 0;
          break;

        case "circle":
          const radius = annotation.radius * Math.min(imageSize.width, imageSize.height);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          if (annotation.fillColor && annotation.fillColor !== "transparent") {
            ctx.fillStyle = getColorHex(annotation.fillColor);
            ctx.fill();
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          break;

        case "text":
          const textWidth = annotation.width * imageSize.width;
          const fontSize = Math.max(14, Math.min(18, textWidth / 12));
          ctx.font = `${fontSize}px Inter Tight, sans-serif`;
          ctx.fillStyle = getColorHex(annotation.textColor);
          ctx.shadowBlur = 0;
          
          if (annotation.background === "soft") {
            const metrics = ctx.measureText(annotation.text);
            const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.fillRect(x - 6, y - textHeight - 6, textWidth + 12, textHeight + 12);
            ctx.fillStyle = getColorHex(annotation.textColor);
          }
          
          // Simple text wrapping
          const words = annotation.text.split(" ");
          let line = "";
          let lineY = y;
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + " ";
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > textWidth && i > 0) {
              ctx.fillText(line, x, lineY);
              line = words[i] + " ";
              lineY += fontSize * 1.3;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, x, lineY);
          break;
      }

      // Draw selection handles
      if (isSelected) {
        drawSelectionHandles(ctx, annotation);
      }
    });
    
    // Draw temporary annotation during drawing
    if (tempAnnotation) {
      const isSelected = tempAnnotation.annotationId === selectedAnnotationId;
      // Draw the temp annotation (same drawing logic as above)
      const x = tempAnnotation.x * imageSize.width;
      const y = tempAnnotation.y * imageSize.height;
      ctx.strokeStyle = getColorHex(tempAnnotation.strokeColor);
      ctx.lineWidth = getStrokeWidthPx(tempAnnotation.strokeWidth);
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      switch (tempAnnotation.type) {
        case "pin":
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = getColorHex(tempAnnotation.strokeColor);
          ctx.fill();
          ctx.stroke();
          break;

        case "arrow":
          const fromX = tempAnnotation.from.x * imageSize.width;
          const fromY = tempAnnotation.from.y * imageSize.height;
          const toX = tempAnnotation.to.x * imageSize.width;
          const toY = tempAnnotation.to.y * imageSize.height;
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();
          // Arrowhead
          const angle = Math.atan2(toY - fromY, toX - fromX);
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - 10 * Math.cos(angle - Math.PI / 6), toY - 10 * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - 10 * Math.cos(angle + Math.PI / 6), toY - 10 * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
          break;

        case "rect":
          const rectWidth = (tempAnnotation.width || 0) * imageSize.width;
          const rectHeight = (tempAnnotation.height || 0) * imageSize.height;
          ctx.strokeRect(x, y, rectWidth, rectHeight);
          if (tempAnnotation.fillColor && tempAnnotation.fillColor !== "transparent") {
            ctx.fillStyle = getColorHex(tempAnnotation.fillColor);
            ctx.fillRect(x, y, rectWidth, rectHeight);
          }
          break;

        case "circle":
          const radius = (tempAnnotation.radius || 0) * Math.min(imageSize.width, imageSize.height);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
          if (tempAnnotation.fillColor && tempAnnotation.fillColor !== "transparent") {
            ctx.fillStyle = getColorHex(tempAnnotation.fillColor);
            ctx.fill();
          }
          break;

        case "text":
          try {
            const textWidth = (tempAnnotation.width || DEFAULT_SIZES.text.width) * imageSize.width;
            const fontSize = Math.max(14, Math.min(18, textWidth / 12));
            ctx.font = `${fontSize}px Inter Tight, sans-serif`;
            ctx.fillStyle = getColorHex(tempAnnotation.textColor || "charcoal");
            ctx.shadowBlur = 0;
            if (tempAnnotation.background === "soft") {
              const metrics = ctx.measureText(tempAnnotation.text || "Text");
              const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
              ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
              ctx.fillRect(x - 6, y - textHeight - 6, textWidth + 12, textHeight + 12);
              ctx.fillStyle = getColorHex(tempAnnotation.textColor || "charcoal");
            }
            ctx.fillText(tempAnnotation.text || "Text", x, y);
          } catch (error) {
            console.error("Error drawing text annotation:", error);
          }
          break;
      }
    }
    } catch (error) {
      console.error("Error in drawAnnotations:", error);
    }
  }, [annotations, selectedAnnotationId, imageSize, tempAnnotation]);

  // Define drawCanvas (uses drawAnnotations)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawAnnotations(ctx);
    };
    img.onerror = () => {
      console.error("Failed to load image for annotation editor");
    };
    img.src = imageUrl;
  }, [imageUrl, imageSize, drawAnnotations]);

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
  }, [annotations, selectedAnnotationId, imageSize, tempAnnotation, drawCanvas]);

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
    
    setAutosaveStatus('saving');
    try {
      // Increment versions for append-only log
      const versionedAnnotations = currentAnnotations.map((ann) => ({
        ...ann,
        version: ann.version + 1,
      }));
      
      await onSave(versionedAnnotations, true); // true = autosave, don't close
      
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
    
    const timer = setTimeout(() => {
      handleAutosave();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [annotations, hasUnsavedChanges, handleAutosave]);

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
      setShowConfirmClose(true);
    } else {
      onCancel();
    }
  }, [hasUnsavedChanges, onCancel, annotations.length]);

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

  const getAnnotationAtPoint = (x: number, y: number, hitArea: number = 15): Annotation | null => {
    if (!imageSize || !canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;
    const relX = canvasX / imageSize.width;
    const relY = canvasY / imageSize.height;

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

        case "text":
          const textWidth = ann.width * imageSize.width;
          const textHeight = 24; // Approximate
          if (
            canvasX >= annX &&
            canvasX <= annX + textWidth &&
            canvasY >= annY - textHeight &&
            canvasY <= annY
          ) {
            return ann;
          }
          break;
      }
    }
    return null;
  };

  // Unified handler for both mouse and touch
  const handlePointerStart = (clientX: number, clientY: number) => {
    if (!imageSize) return;
    
    // Increase hit area on mobile for easier selection
    const hitArea = isMobile ? 20 : 15;
    const clickedAnnotation = getAnnotationAtPoint(clientX, clientY, hitArea);
    
    if (clickedAnnotation) {
      setSelectedAnnotationId(clickedAnnotation.annotationId);
      setCurrentTool(null);
      
      // Start dragging existing annotation
      const coords = getRelativeCoords(clientX, clientY);
      if (coords) {
        setIsDragging(true);
        setDragOffset({
          x: coords.x - clickedAnnotation.x,
          y: coords.y - clickedAnnotation.y,
        });
      }
      return;
    }

    // Start drawing new annotation if tool is selected
    if (currentTool) {
      const coords = getRelativeCoords(clientX, clientY);
      if (!coords) return;

      // For pin tool, create immediately (single click)
      if (currentTool === "pin") {
        const newAnnotation: Annotation = {
          annotationId: crypto.randomUUID(),
          version: 1,
          type: "pin",
          x: coords.x,
          y: coords.y,
          strokeColor: selectedColor,
          strokeWidth: selectedStrokeWidth,
        };
        setAnnotations([...annotations, newAnnotation]);
        setSelectedAnnotationId(newAnnotation.annotationId);
        setCurrentTool(null);
        return;
      }

      // For other tools, start click-and-drag
      setIsDrawing(true);
      setDrawStart(coords);
      
      // Create temporary annotation for preview
      const temp: Annotation = {
        annotationId: crypto.randomUUID(),
        version: 1,
        type: currentTool,
        x: coords.x,
        y: coords.y,
        strokeColor: selectedColor,
        strokeWidth: selectedStrokeWidth,
        ...(currentTool === "arrow" && {
          from: coords,
          to: coords,
        }),
        ...(currentTool === "rect" && {
          width: 0,
          height: 0,
        }),
        ...(currentTool === "circle" && {
          radius: 0,
        }),
        ...(currentTool === "text" && {
          width: DEFAULT_SIZES.text.width,
          text: "Text",
          textColor: selectedColor,
          background: "none",
        }),
      } as Annotation;
      
      setTempAnnotation(temp);
    } else {
      setSelectedAnnotationId(null);
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!imageSize) return;
    
    const coords = getRelativeCoords(clientX, clientY);
    if (!coords) return;

    // Handle drawing new annotation (click-and-drag)
    if (isDrawing && drawStart && tempAnnotation) {
      const dx = coords.x - drawStart.x;
      const dy = coords.y - drawStart.y;
      
      const updated: Annotation = {
        ...tempAnnotation,
        ...(tempAnnotation.type === "arrow" && {
          to: coords,
        }),
        ...(tempAnnotation.type === "rect" && {
          width: Math.abs(dx),
          height: Math.abs(dy),
          x: dx < 0 ? coords.x : drawStart.x,
          y: dy < 0 ? coords.y : drawStart.y,
        }),
        ...(tempAnnotation.type === "circle" && {
          radius: Math.sqrt(dx * dx + dy * dy),
        }),
        ...(tempAnnotation.type === "text" && {
          width: Math.max(0.05, Math.abs(dx)), // Minimum width for text
        }),
      } as Annotation;
      
      setTempAnnotation(updated);
      return;
    }
    
    // Handle dragging existing annotation
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
              from: {
                x: ann.from.x + deltaX,
                y: ann.from.y + deltaY,
              },
              to: {
                x: ann.to.x + deltaX,
                y: ann.to.y + deltaY,
              },
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
    // Finish drawing new annotation
    if (isDrawing && tempAnnotation) {
      // Only commit if shape has meaningful size
      const hasSize = 
        (tempAnnotation.type === "arrow" && tempAnnotation.to) ||
        (tempAnnotation.type === "rect" && (tempAnnotation.width || 0) > 0.01 && (tempAnnotation.height || 0) > 0.01) ||
        (tempAnnotation.type === "circle" && (tempAnnotation.radius || 0) > 0.01) ||
        (tempAnnotation.type === "text" && (tempAnnotation.width || 0) > 0.05); // Text needs minimum width
      
      if (hasSize) {
        setAnnotations([...annotations, tempAnnotation]);
        setSelectedAnnotationId(tempAnnotation.annotationId);
      }
      
      setIsDrawing(false);
      setDrawStart(null);
      setTempAnnotation(null);
      setCurrentTool(null); // Auto-deselect tool after creation
      
      if (tempAnnotation.type === "text") {
        setEditingText(tempAnnotation.text || "Text");
      }
    }
    
    setIsDragging(false);
    setDragOffset(null);
  };

  const handleCanvasMouseUp = () => {
    handlePointerEnd();
  };
  
  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handlePointerEnd();
  };

  const handleDelete = () => {
    if (selectedAnnotationId) {
      setAnnotations(annotations.filter((a) => a.annotationId !== selectedAnnotationId));
      setSelectedAnnotationId(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setAutosaveStatus('saving');
    try {
      // Only save if changed
      if (!hasUnsavedChanges) {
        setIsSaving(false);
        setAutosaveStatus('idle');
        return;
      }
      
      // Increment versions for append-only log
      const versionedAnnotations = annotations.map((ann) => ({
        ...ann,
        version: ann.version + 1,
      }));
      await onSave(versionedAnnotations, false); // false = manual save
      setLastSavedAnnotations(annotations);
      setAutosaveStatus('saved');
      
      setTimeout(() => {
        setAutosaveStatus('idle');
      }, 1000);
    } catch (error) {
      console.error("Failed to save annotations:", error);
      setAutosaveStatus('idle');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAnnotation = annotations.find((a) => a.annotationId === selectedAnnotationId);

  // Track tool changes
  useEffect(() => {
  }, [currentTool, imageSize, annotations.length, isMobile]);

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] bg-black/80 flex flex-col",
        isMobile ? "fullscreen" : ""
      )}
      onClick={(e) => {
        const targetEl = e.target as HTMLElement;
        // Don't close on overlay click - only close via Cancel button
        if (targetEl?.closest('button')) {
          return; // Let button handle its own click
        }
        if (e.target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
    >
      {/* Toolbar - Top on desktop, bottom on mobile for thumb access */}
      <div className={cn(
        "absolute flex items-center gap-1 p-2 bg-black/60 backdrop-blur-sm rounded-lg z-10",
        isMobile ? "bottom-4 left-1/2 -translate-x-1/2 flex-wrap justify-center" : "top-4 left-4"
      )}>
        {/* Undo/Redo buttons */}
        <button
          onClick={handleUndo}
          disabled={historyIndex === 0}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            historyIndex === 0 && "opacity-50 cursor-not-allowed"
          )}
          title="Undo"
        >
          <Undo2 className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIndex === history.length - 1}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            historyIndex === history.length - 1 && "opacity-50 cursor-not-allowed"
          )}
          title="Redo"
        >
          <Redo2 className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
        <div className="w-px h-6 bg-white/20 mx-1" />
        <button
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              const newTool = currentTool === "pin" ? null : "pin";
              setCurrentTool(newTool);
            } catch (error) {
              console.error('Error in pin tool click:', error);
            }
          }}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            currentTool === "pin" && "bg-white/20"
          )}
          title="Pin"
        >
          <SquarePen className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
        <button
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              const newTool = currentTool === "arrow" ? null : "arrow";
              // Cancel any active drawing when switching tools
              if (isDrawing) {
                setIsDrawing(false);
                setDrawStart(null);
                setTempAnnotation(null);
              }
              setCurrentTool(newTool);
            } catch (error) {
              console.error('Error in arrow tool click:', error);
            }
          }}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            currentTool === "arrow" && "bg-white/20"
          )}
          title="Arrow"
        >
          <ArrowRight className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
        <button
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              const newTool = currentTool === "rect" ? null : "rect";
              // Cancel any active drawing when switching tools
              if (isDrawing) {
                setIsDrawing(false);
                setDrawStart(null);
                setTempAnnotation(null);
              }
              setCurrentTool(newTool);
            } catch (error) {
              console.error('Error in rect tool click:', error);
            }
          }}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            currentTool === "rect" && "bg-white/20"
          )}
          title="Rectangle"
        >
          <Square className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
        <button
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              const newTool = currentTool === "circle" ? null : "circle";
              // Cancel any active drawing when switching tools
              if (isDrawing) {
                setIsDrawing(false);
                setDrawStart(null);
                setTempAnnotation(null);
              }
              setCurrentTool(newTool);
            } catch (error) {
              console.error('Error in circle tool click:', error);
            }
          }}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            currentTool === "circle" && "bg-white/20"
          )}
          title="Circle"
        >
          <Circle className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
        <button
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              const newTool = currentTool === "text" ? null : "text";
              // Cancel any active drawing when switching tools
              if (isDrawing) {
                setIsDrawing(false);
                setDrawStart(null);
                setTempAnnotation(null);
              }
              setCurrentTool(newTool);
            } catch (error) {
              console.error("Error selecting text tool:", error);
            }
          }}
          className={cn(
            "rounded hover:bg-white/10 transition-colors",
            isMobile ? "p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-2",
            currentTool === "text" && "bg-white/20"
          )}
          title="Text"
        >
          <Type className={cn("text-white", isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onTouchCancel={handleCanvasTouchEnd}
          className="max-w-full max-h-full cursor-crosshair"
          style={{
            touchAction: "none"
          }}
        />
      </div>

      {/* Context Panel - Bottom-right, only when annotation selected */}
      {selectedAnnotation && (
        <div className="absolute bottom-20 right-4 bg-black/70 backdrop-blur-md rounded-lg p-4 space-y-3 min-w-[240px] border border-white/10 z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-semibold">Edit Annotation</span>
            <button
              onClick={() => setSelectedAnnotationId(null)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Color Picker */}
          <div className="space-y-1.5">
            <label className="text-white/80 text-xs font-medium">
              {selectedAnnotation.type === "text" ? "Text Color" : "Stroke Color"}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(ANNOTATION_COLORS).map(([color, hex]) => (
                <button
                  key={color}
                  onClick={() => {
                    setAnnotations(
                      annotations.map((a) =>
                        a.annotationId === selectedAnnotationId
                          ? selectedAnnotation.type === "text"
                            ? { ...a, textColor: color as AnnotationColor }
                            : { ...a, strokeColor: color as AnnotationColor }
                          : a
                      )
                    );
                  }}
                  className={cn(
                    "w-7 h-7 rounded border-2 transition-all",
                    (selectedAnnotation.type === "text"
                      ? selectedAnnotation.textColor
                      : selectedAnnotation.strokeColor) === color
                      ? "border-white scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: hex }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Fill Color (rect/circle only) */}
          {(selectedAnnotation.type === "rect" || selectedAnnotation.type === "circle") && (
            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-medium">Fill Color</label>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    setAnnotations(
                      annotations.map((a) =>
                        a.annotationId === selectedAnnotationId
                          ? { ...a, fillColor: "transparent" }
                          : a
                      )
                    );
                  }}
                  className={cn(
                    "w-7 h-7 rounded border-2 transition-all bg-transparent",
                    selectedAnnotation.fillColor === "transparent" || !selectedAnnotation.fillColor
                      ? "border-white scale-110"
                      : "border-white/30 hover:scale-105"
                  )}
                  title="Transparent"
                />
                {Object.entries(ANNOTATION_COLORS).map(([color, hex]) => (
                  <button
                    key={color}
                    onClick={() => {
                      setAnnotations(
                        annotations.map((a) =>
                          a.annotationId === selectedAnnotationId
                            ? { ...a, fillColor: color as AnnotationColor }
                            : a
                        )
                      );
                    }}
                    className={cn(
                      "w-7 h-7 rounded border-2 transition-all",
                      selectedAnnotation.fillColor === color
                        ? "border-white scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: hex }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Line Width (not for text) */}
          {selectedAnnotation.type !== "text" && (
            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-medium">Line Width</label>
              <div className="flex gap-1.5">
                {(["thin", "medium", "bold"] as const).map((width) => (
                  <button
                    key={width}
                    onClick={() => {
                      setAnnotations(
                        annotations.map((a) =>
                          a.annotationId === selectedAnnotationId
                            ? { ...a, strokeWidth: width }
                            : a
                        )
                      );
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium text-white transition-colors",
                      selectedAnnotation.strokeWidth === width
                        ? "bg-white/20"
                        : "hover:bg-white/10"
                    )}
                  >
                    {width}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Input (text only) */}
          {selectedAnnotation.type === "text" && (
            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-medium">Text</label>
              <Input
                value={editingText || selectedAnnotation.text}
                onChange={(e) => {
                  setEditingText(e.target.value);
                  setAnnotations(
                    annotations.map((a) =>
                      a.annotationId === selectedAnnotationId
                        ? { ...a, text: e.target.value }
                        : a
                    )
                  );
                }}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                placeholder="Enter text..."
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setAnnotations(
                      annotations.map((a) =>
                        a.annotationId === selectedAnnotationId
                          ? { ...a, background: "none" }
                          : a
                      )
                    );
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium text-white transition-colors",
                    selectedAnnotation.background === "none"
                      ? "bg-white/20"
                      : "hover:bg-white/10"
                  )}
                >
                  None
                </button>
                <button
                  onClick={() => {
                    setAnnotations(
                      annotations.map((a) =>
                        a.annotationId === selectedAnnotationId
                          ? { ...a, background: "soft" }
                          : a
                      )
                    );
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium text-white transition-colors",
                    selectedAnnotation.background === "soft"
                      ? "bg-white/20"
                      : "hover:bg-white/10"
                  )}
                >
                  Soft
                </button>
              </div>
            </div>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {/* Autosave Indicator - Top-right */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 z-10">
        <div className="flex items-center gap-2 text-white text-sm">
          {autosaveStatus === 'saving' && (
            <>
              <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
              <span>Saving...</span>
            </>
          )}
          {autosaveStatus === 'saved' && (
            <>
              <div className="h-3 w-3 bg-green-500 rounded-full" />
              <span>Saved</span>
            </>
          )}
          {autosaveStatus === 'idle' && hasUnsavedChanges && (
            <span className="text-white/70">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Save/Cancel/Reset Buttons - Bottom-left */}
      <div className="absolute bottom-4 left-4 flex gap-2 z-10">
        <Button
          onClick={handleCancel}
          variant="outline"
          className="bg-black/50 border-white/20 text-white hover:bg-black/70"
        >
          Cancel
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="bg-black/50 border-white/20 text-white hover:bg-black/70"
          disabled={JSON.stringify(annotations) === JSON.stringify(initialAnnotations)}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="bg-primary text-primary-foreground"
        >
          {isSaving ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={showConfirmClose} 
        onOpenChange={(open) => {
          setShowConfirmClose(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved annotations. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmClose(false);
                onCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                await handleSave();
                setShowConfirmClose(false);
                onCancel();
              }}
            >
              Save & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
