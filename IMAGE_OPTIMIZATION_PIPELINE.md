# Image Optimization Pipeline

## Overview
The image optimization pipeline automatically generates optimized WebP thumbnails for uploaded images, reducing file sizes from ~10MB to ~50KB for fast page loads.

## Architecture

### 1. Edge Function: `process-image`
**Location:** `supabase/functions/process-image/index.ts`

**Input:**
```typescript
{
  bucket: string;      // Storage bucket name (e.g., "property-images")
  path: string;        // Path to the uploaded image
  recordId: string;    // Database record ID to update
  table: string;       // Database table name (e.g., "properties")
}
```

**Process:**
1. Downloads the original image from Storage
2. Generates a 300x300px WebP thumbnail using Sharp
3. Uploads thumbnail back to Storage (path: `{originalPath}_thumb.webp`)
4. Updates database record with `thumbnail_url`

**Output:**
```typescript
{
  ok: true,
  data: {
    thumbnailUrl: string;    // Public URL of thumbnail
    thumbnailPath: string;   // Storage path of thumbnail
    originalPath: string;    // Original image path
    recordId: string;
    table: string;
  }
}
```

### 2. Hook: `useFileUpload`
**Location:** `src/hooks/useFileUpload.ts`

**Features:**
- Uploads files to Supabase Storage
- Automatically triggers thumbnail generation via edge function
- Returns both original URL and thumbnail URL

**Usage:**
```typescript
const { uploadFile, isUploading } = useFileUpload({
  bucket: "property-images",
  generateThumbnail: true,
  recordId: propertyId,
  table: "properties",
  onSuccess: (url, thumbnailUrl) => {
    // Handle success
  },
  onError: (error) => {
    // Handle error
  },
});

await uploadFile(file, customPath);
```

## Current Implementation Status

### ✅ Completed
- Edge function `process-image` created and configured
- `useFileUpload` hook with thumbnail generation support
- `PropertyDetail.tsx` updated to use `useFileUpload` hook

### 📋 Image Sizes on Cards
- **PropertyCard**: `h-32` (128px height, full width) - uses `thumbnail_url`
- **TaskCard**: `w-24 sm:w-28` (96px/112px width) - uses `primary_image_url` or `image_url`
- **Property Photo Thumbnails**: `w-24 h-24` (96px × 96px square)

### 🔄 Storage Strategy
- **Original images**: Stored at full size in Storage
- **Thumbnails**: Generated automatically as WebP (300x300px, ~50KB)
- **Database**: `thumbnail_url` field stores the optimized thumbnail URL
- **Cards**: Display thumbnails for fast loading
- **Detail views**: Can display full-size originals when needed

## Deployment

The edge function needs to be deployed to Supabase:

```bash
# Deploy the function
npx supabase functions deploy process-image

# Or via Supabase Dashboard:
# 1. Go to Edge Functions
# 2. Deploy process-image function
```

## Testing

1. Upload an image on PropertyDetail page
2. Check Storage bucket for both original and `*_thumb.webp` file
3. Verify `properties.thumbnail_url` is updated in database
4. Confirm PropertyCard displays the optimized thumbnail

## Future Enhancements

- [ ] Add multiple thumbnail sizes (small, medium, large)
- [ ] Support for other image types (assets, tasks, spaces)
- [ ] Automatic cleanup of old thumbnails
- [ ] Progressive image loading (blur-up technique)
- [ ] Image compression for originals (reduce from 10MB to ~1MB)

