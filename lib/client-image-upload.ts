import { createSlug } from "./magic-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function uploadImageToBucket({
  fileValue,
  bucket,
  folder,
  accessToken,
}: {
  fileValue: FormDataEntryValue | File | null;
  bucket: string;
  folder: string;
  accessToken?: string;
}) {
  if (!(fileValue instanceof File) || fileValue.size === 0) return "";

  if (!supabaseUrl || !supabaseKey || !accessToken) {
    throw new Error("Sign in again before uploading an image.");
  }

  const compressed = await compressImage(fileValue);
  const baseName = createSlug(compressed.name.replace(/\.[^.]+$/, "")) || "upload";
  const ext = compressed.type === "image/webp" ? ".webp" : extensionFor(fileValue);
  const objectPath = `${folder}/${Date.now()}-${baseName}${ext}`;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": compressed.type,
      "x-upsert": "false",
    },
    body: compressed,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(body?.message || body?.error || `Supabase upload failed: ${response.status}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function compressImage(
  file: File,
  { maxDimension = 1280, quality = 0.82 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (file.type === "image/gif") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      const targetWidth = Math.round(img.naturalWidth * scale);
      const targetHeight = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

function extensionFor(file: File) {
  const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  if (extension && [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    return extension === ".jpeg" ? ".jpg" : extension;
  }

  const mimeExtension = file.type.split("/")[1];
  return mimeExtension ? `.${mimeExtension}` : ".jpg";
}
