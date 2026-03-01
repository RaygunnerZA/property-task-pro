import type { TempImage, OptimizedImageResult } from "@/types/temp-image";

/**
 * Generate optimized images client-side
 * Returns thumbnail (200x200) and optimized (max 1200px) versions as WebP blobs
 */
export async function generateOptimizedImages(
  file: File
): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = async () => {
      try {
        // Generate thumbnail (200x200px) using center-crop to preserve aspect ratio.
        // This avoids portrait images being squashed into square thumbnails.
        canvas.width = 200;
        canvas.height = 200;
        const srcAspect = img.width / img.height;
        const targetAspect = 1; // square thumbnail

        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (srcAspect > targetAspect) {
          // Source is wider than square: crop left/right.
          sw = img.height * targetAspect;
          sx = (img.width - sw) / 2;
        } else if (srcAspect < targetAspect) {
          // Source is taller than square: crop top/bottom.
          sh = img.width / targetAspect;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 200, 200);
        const thumbnail = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (blob) => blob ? res(blob) : rej(new Error('Thumbnail generation failed')),
            'image/webp',
            0.75
          );
        });

        // Generate optimized (max 1200px longest side, WebP, 85% quality)
        const maxDimension = 1200;
        const scale = Math.min(
          maxDimension / img.width,
          maxDimension / img.height,
          1 // Don't upscale
        );
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const optimized = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (blob) => blob ? res(blob) : rej(new Error('Optimized generation failed')),
            'image/webp',
            0.85
          );
        });

        resolve({ thumbnail, optimized });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Create a TempImage from a File
 */
export async function createTempImage(file: File): Promise<TempImage> {
  const { thumbnail, optimized } = await generateOptimizedImages(file);
  
  return {
    local_id: crypto.randomUUID(),
    display_name: file.name,
    original_file: file,
    thumbnail_blob: thumbnail,
    optimized_blob: optimized,
    annotation_json: [],
    uploaded: false,
    upload_status: 'pending',
    thumbnail_url: URL.createObjectURL(thumbnail),
    optimized_url: URL.createObjectURL(optimized),
  };
}

/**
 * Clean up blob URLs to prevent memory leaks
 */
export function cleanupTempImage(tempImage: TempImage) {
  if (tempImage.thumbnail_url) {
    URL.revokeObjectURL(tempImage.thumbnail_url);
  }
  if (tempImage.optimized_url) {
    URL.revokeObjectURL(tempImage.optimized_url);
  }
}
