export type AnnotationStrokeWidth = "thin" | "medium" | "bold";
export type AnnotationColor = 
  | "charcoal" 
  | "white" 
  | "warning-orange" 
  | "danger-red" 
  | "calm-blue" 
  | "success-green";

export type AnnotationBackground = "none" | "soft";

export interface AnnotationBase {
  annotationId: string;
  version: number;
  type: "pin" | "arrow" | "rect" | "circle" | "text";
  x: number; // 0-1 relative
  y: number; // 0-1 relative
  strokeColor: AnnotationColor;
  strokeWidth: AnnotationStrokeWidth;
}

export interface PinAnnotation extends AnnotationBase {
  type: "pin";
}

export interface ArrowAnnotation extends AnnotationBase {
  type: "arrow";
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface RectAnnotation extends AnnotationBase {
  type: "rect";
  width: number; // 0-1 relative
  height: number; // 0-1 relative
  fillColor?: AnnotationColor | "transparent";
}

export interface CircleAnnotation extends AnnotationBase {
  type: "circle";
  radius: number; // 0-1 relative
  fillColor?: AnnotationColor | "transparent";
}

export interface TextAnnotation extends AnnotationBase {
  type: "text";
  width: number; // 0-1 relative
  text: string;
  textColor: AnnotationColor;
  background: AnnotationBackground;
}

export type Annotation = 
  | PinAnnotation 
  | ArrowAnnotation 
  | RectAnnotation 
  | CircleAnnotation 
  | TextAnnotation;

export interface TaskImageAnnotationRecord {
  id: string;
  task_id: string;
  image_id: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  annotations: Annotation[];
}

// Unified annotation context for pre-upload and post-upload modes
export type AnnotationContext = 
  | { 
      mode: "pre-upload"; 
      annotations: Annotation[]; 
      onSave: (annotations: Annotation[]) => void;
    }
  | { 
      mode: "post-upload"; 
      taskId: string; 
      imageId: string; 
      annotations: Annotation[];
      onSave: (annotations: Annotation[]) => Promise<void>;
    };

// Alternative JSON schema (for future compatibility)
export interface AnnotationDocument {
  version: number;
  elements: AnnotationElement[];
}

export interface AnnotationElement {
  id: string;
  type: "arrow" | "pen" | "box" | "text" | "pin" | "circle";
  coords: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    from?: { x: number; y: number };
    to?: { x: number; y: number };
    radius?: number;
    points?: Array<{ x: number; y: number }>; // For freehand
  };
  color: string; // Hex color
  text?: string;
  strokeWidth?: number;
  fillColor?: string;
  background?: "none" | "soft";
}
