import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Paperclip, X, Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UploadedFile {
  objectPath: string;
  fileName: string;
  fileType: string;
  contentType: string;
}

interface EvidenceUploadButtonProps {
  onUploadComplete: (file: UploadedFile) => void;
  onUploadRemove: () => void;
  uploadedFile: UploadedFile | null;
  compact?: boolean;
}

export function EvidenceUploadButton({ onUploadComplete, onUploadRemove, uploadedFile, compact }: EvidenceUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File must be under 20MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const presignRes = await apiRequest("POST", "/api/evidence/presign", {
        fileName: file.name,
        contentType: file.type,
      });
      const { uploadUrl, objectPath } = await presignRes.json();

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      let fileType = "document";
      if (file.type.startsWith("image/")) fileType = "image";
      else if (file.type.startsWith("audio/")) fileType = "audio";
      else if (file.type.startsWith("video/")) fileType = "video";
      else if (file.type === "application/pdf") fileType = "pdf";

      onUploadComplete({
        objectPath,
        fileName: file.name,
        fileType,
        contentType: file.type,
      });
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded-lg px-3 py-2" data-testid="evidence-upload-preview">
        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="truncate flex-1 text-foreground">{uploadedFile.fileName}</span>
        <button
          type="button"
          onClick={onUploadRemove}
          className="text-muted-foreground hover:text-destructive flex-shrink-0"
          aria-label="Remove file"
          data-testid="button-remove-evidence"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,audio/*,video/mp4"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-evidence-file"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-attach-evidence"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 mr-1" />
          )}
          {uploading ? "Uploading..." : "Attach Photo / File"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive" data-testid="text-upload-error">{error}</p>}
    </div>
  );
}
