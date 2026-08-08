"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDeletePropertyMedia, useUploadPropertyMedia } from "@/lib/queries/properties";
import { ApiError } from "@/lib/api";

export function MediaGallery({
  propertyId,
  images,
  videos,
  canManage,
}: {
  propertyId: string;
  images: string[];
  videos: string[];
  canManage: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMedia = useUploadPropertyMedia(propertyId);
  const deleteMedia = useDeletePropertyMedia(propertyId);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        await uploadMedia.mutateAsync(file);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Upload failed";
        toast.error(`${file.name}: ${message}`);
        return;
      }
    }
    toast.success("Media uploaded");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (url: string) => {
    try {
      await deleteMedia.mutateAsync(url);
      toast.success("Media removed");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to remove media";
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Media</h2>
        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadMedia.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMedia.isPending ? "Uploading..." : "Upload media"}
            </Button>
          </>
        )}
      </div>

      {images.length === 0 && videos.length === 0 && (
        <p className="text-sm text-muted-foreground">No media uploaded yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((url) => (
          <div key={url} className="group relative overflow-hidden rounded-lg border">
            {/* External CDN URLs (Cloudinary or otherwise) -- plain img avoids next/image's remotePatterns allowlist. */}
            <img src={url} alt="" className="aspect-square w-full object-cover" />
            {canManage && (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleDelete(url)}
                disabled={deleteMedia.isPending}
              >
                x
              </Button>
            )}
          </div>
        ))}

        {videos.map((url) => (
          <div key={url} className="group relative overflow-hidden rounded-lg border">
            <video src={url} controls className="aspect-square w-full object-cover" />
            {canManage && (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleDelete(url)}
                disabled={deleteMedia.isPending}
              >
                x
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
