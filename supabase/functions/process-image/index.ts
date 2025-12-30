// process-image — Image Optimization Pipeline
// Generates thumbnails for uploaded images and updates database records

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sharp from "https://esm.sh/sharp@0.33.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create admin client with service role key to bypass RLS
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonErr("POST only", 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const { bucket, path, recordId, table } = body;

  if (!bucket || !path || !recordId || !table) {
    return jsonErr("Missing required fields: bucket, path, recordId, table", 400);
  }

  try {
    // Step 1: Download the original image from Storage
    const { data: imageData, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);

    if (downloadError || !imageData) {
      return jsonErr(`Failed to download image: ${downloadError?.message || "Unknown error"}`, 500);
    }

    // Convert Blob to ArrayBuffer for sharp
    const imageBuffer = await imageData.arrayBuffer();
    const imageUint8Array = new Uint8Array(imageBuffer);

    // Step 2: Generate thumbnail using sharp
    // Target: 300px width, WebP format, ~50KB size
    const thumbnailBuffer = await sharp(imageUint8Array)
      .resize(300, 300, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 80,
        effort: 4,
      })
      .toBuffer();

    // Step 3: Generate thumbnail path (e.g., original/path/thumb.webp)
    const pathParts = path.split("/");
    const fileName = pathParts.pop() || "image";
    const dirPath = pathParts.join("/");
    const fileNameWithoutExt = fileName.split(".").slice(0, -1).join(".");
    const thumbnailPath = dirPath ? `${dirPath}/${fileNameWithoutExt}_thumb.webp` : `${fileNameWithoutExt}_thumb.webp`;

    // Step 4: Upload thumbnail back to Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return jsonErr(`Failed to upload thumbnail: ${uploadError.message}`, 500);
    }

    // Step 5: Get public URL for thumbnail
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(thumbnailPath);

    const thumbnailUrl = urlData.publicUrl;

    // Step 6: Update database record with thumbnail_url
    // Use admin client to bypass RLS
    const { data: updatedRecords, error: updateError } = await supabaseAdmin
      .from(table)
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", recordId)
      .select();

    if (updateError) {
      console.error("Failed to update database record:", updateError);
      return jsonErr(`Thumbnail created but database update failed: ${updateError.message}`, 500);
    }

    if (!updatedRecords || updatedRecords.length === 0) {
      console.error("No records updated - record may not exist");
      return jsonErr("Thumbnail created but record not found in database", 404);
    }

    return jsonOK({
      thumbnailUrl,
      thumbnailPath,
      originalPath: path,
      recordId,
      table,
    });
  } catch (error: any) {
    console.error("Error processing image:", error);
    return jsonErr(`Image processing failed: ${error.message}`, 500);
  }
});

// Helper functions
const jsonOK = (data: any) =>
  new Response(JSON.stringify({ ok: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const jsonErr = (msg: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

