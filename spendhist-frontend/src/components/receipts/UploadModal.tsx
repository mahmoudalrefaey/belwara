"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { useUploadReceipts } from "@/hooks/useReceipts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function UploadModal({ open, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const { mutateAsync, isPending } = useUploadReceipts();

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
    disabled: isPending,
  });

  const removeAt = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    try {
      const { receipts } = await mutateAsync(files);
      toast.success(
        receipts.length === 1
          ? "Uploaded. We're reading your receipt now."
          : `Uploaded ${receipts.length} receipts. We're reading them now.`,
      );
      setFiles([]);
      onClose();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        .response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail as { message?: string } | undefined)?.message;
      toast.error(message ?? "Upload failed. Please check your files and try again.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFiles([]);
          if (!isPending) onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload receipts</DialogTitle>
          <DialogDescription>
            Drop images or PDFs. Multiple files are supported.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            "flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm transition-colors",
            isDragActive && "border-primary bg-primary/5",
            isPending && "pointer-events-none opacity-60",
          )}
        >
          <input {...getInputProps()} />
          <p className="text-muted-foreground">
            Drag files here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WebP, or PDF
          </p>
        </div>

        {files.length > 0 && (
          <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-2 text-sm">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  disabled={isPending}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={isPending || files.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
