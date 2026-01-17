export type AnnotationPayload = {
  type: "pen" | "arrow" | "circle" | "text";
  points?: [number, number][];
  color: string;
  thickness: number;
  content?: string;
};

export type AnnotationSavePayload = {
  annotations: AnnotationPayload[];
  previewDataUrl: string;
};
