import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImageAnnotationEditor } from "./ImageAnnotationEditor";
import type { AnnotationSavePayload, AnnotationPayload } from "@/types/annotation-payload";

interface ImageAnnotationEditorWrapperProps {
  open: boolean;
  imageUrl: string;
  initialAnnotations?: AnnotationPayload[];
  onSave: (data: AnnotationSavePayload) => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ImageAnnotationEditorWrapper({
  open,
  imageUrl,
  initialAnnotations,
  onSave,
  onCancel,
  onOpenChange,
}: ImageAnnotationEditorWrapperProps) {
  const isMobile = useIsMobile();

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleSave = (data: AnnotationSavePayload) => {
    onSave(data);
    onOpenChange(false);
  };

  const content = (
    <div className="w-full h-[100dvh] bg-surface-gradient">
      <ImageAnnotationEditor
        imageUrl={imageUrl}
        initialAnnotations={initialAnnotations}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="p-0 h-[100dvh] bg-surface-gradient">
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-none w-screen h-screen bg-surface-gradient shadow-e3">
        {content}
      </DialogContent>
    </Dialog>
  );
}
