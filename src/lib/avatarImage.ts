import type { Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "user-avatars";
/** Tiny square used in lists, chips, and nav */
export const AVATAR_SMALL_SIZE = 96;
/** Medium square for profile / larger surfaces */
export const AVATAR_MEDIUM_SIZE = 512;

export type AvatarUploadResult = {
  avatarUrl: string;
  avatarMediumUrl: string;
  smallPath: string;
  mediumPath: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

async function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encode failed"))),
      "image/webp",
      quality,
    );
  });
}

/**
 * Render a square crop from react-easy-crop pixel area into WebP blobs.
 */
export async function cropAvatarVariants(
  imageSrc: string,
  crop: Area,
): Promise<{ small: Blob; medium: Blob }> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const renderSize = async (size: number, quality: number) => {
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size,
      size,
    );
    return canvasToWebpBlob(canvas, quality);
  };

  const medium = await renderSize(AVATAR_MEDIUM_SIZE, 0.85);
  const small = await renderSize(AVATAR_SMALL_SIZE, 0.8);
  return { small, medium };
}

export function avatarPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marker.length));
  } catch {
    return url.slice(idx + marker.length);
  }
}

async function removeAvatarPaths(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  await supabase.storage.from(AVATAR_BUCKET).remove(unique);
}

/** Remove previous avatar objects for this user (best-effort). */
export async function clearUserAvatarFolder(
  userId: string,
  knownUrls: Array<string | null | undefined> = [],
) {
  const fromUrls = knownUrls
    .map(avatarPathFromPublicUrl)
    .filter((p): p is string => !!p);

  try {
    const { data: listed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .list(`avatars/${userId}`, { limit: 100 });
    const fromList = (listed ?? []).map((f) => `avatars/${userId}/${f.name}`);
    await removeAvatarPaths([...fromUrls, ...fromList]);
  } catch {
    await removeAvatarPaths(fromUrls);
  }
}

export async function uploadAvatarVariants(
  userId: string,
  small: Blob,
  medium: Blob,
  previousUrls: Array<string | null | undefined> = [],
): Promise<AvatarUploadResult> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const smallPath = `avatars/${userId}/${stamp}-sm.webp`;
  const mediumPath = `avatars/${userId}/${stamp}-md.webp`;

  await clearUserAvatarFolder(userId, previousUrls);

  const smallFile = new File([small], `${stamp}-sm.webp`, { type: "image/webp" });
  const mediumFile = new File([medium], `${stamp}-md.webp`, { type: "image/webp" });

  const { error: smallError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(smallPath, smallFile, { cacheControl: "31536000", upsert: false, contentType: "image/webp" });
  if (smallError) throw smallError;

  const { error: mediumError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(mediumPath, mediumFile, { cacheControl: "31536000", upsert: false, contentType: "image/webp" });
  if (mediumError) {
    await removeAvatarPaths([smallPath]);
    throw mediumError;
  }

  const {
    data: { publicUrl: avatarUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(smallPath);
  const {
    data: { publicUrl: avatarMediumUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(mediumPath);

  return { avatarUrl, avatarMediumUrl, smallPath, mediumPath };
}
