import React, { useState, useEffect } from "react";

interface ImageEditorProps {
  imageUrl: string;
  onSave: (file: File) => void;
  onClose: () => void;
}

export function ImageEditor({ imageUrl, onSave, onClose }: ImageEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [filerobotModule, setFilerobotModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load Filerobot module dynamically
  useEffect(() => {
    import("react-filerobot-image-editor")
      .then(module => {
        setFilerobotModule(module);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to load Filerobot Image Editor:", error);
        setLoading(false);
      });
  }, []);

  const handleSave = (editedImageObject: any) => {
    setIsSaving(true);
    try {
      // Convert base64 to File
      const base64Data = editedImageObject.imageBase64;
      const base64String = base64Data.split(",")[1] || base64Data;
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });
      const file = new File([blob], "edited-image.png", { type: "image/png" });
      
      onSave(file);
      onClose();
    } catch (error) {
      console.error("Error saving edited image:", error);
      alert("Failed to save edited image. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-white p-8">Loading image editor...</div>
      </div>
    );
  }

  if (!filerobotModule) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-white p-8">Failed to load image editor. Please refresh the page.</div>
      </div>
    );
  }

  const { FilerobotImageEditor, TABS, TOOLS } = filerobotModule;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="w-full h-full">
        <FilerobotImageEditor
          source={imageUrl}
          onSave={handleSave}
          onClose={onClose}
          savingPixelRatio={2}
          previewPixelRatio={2}
          annotationsCommon={{
            fill: "#EB6834",
            stroke: "#EB6834",
            strokeWidth: 3,
          }}
          Text={{ text: "Text" }}
          Rotate={{ angle: 90, componentType: "slider" }}
          Crop={{
            presetsItems: [
              {
                titleKey: "classicTv",
                descriptionKey: "4:3",
                ratio: 4 / 3,
              },
              {
                titleKey: "cinema",
                descriptionKey: "21:9",
                ratio: 21 / 9,
              },
              {
                titleKey: "square",
                descriptionKey: "1:1",
                ratio: 1,
              },
            ],
            presetsFolders: [
              {
                titleKey: "socialMedia",
                groups: [
                  {
                    titleKey: "facebook",
                    items: [
                      {
                        titleKey: "profile",
                        width: 180,
                        height: 180,
                        ratio: 1,
                      },
                      {
                        titleKey: "cover",
                        width: 820,
                        height: 312,
                        ratio: 820 / 312,
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          tabsIds={[TABS.ANNOTATE, TABS.CROP, TABS.ROTATE]}
          defaultTabId={TABS.ANNOTATE}
          defaultToolId={TOOLS.ARROW}
          Watermark={false}
          Filters={false}
        />
      </div>
    </div>
  );
}
