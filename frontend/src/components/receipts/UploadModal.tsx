"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Camera, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { useUploadReceipts } from "@/hooks/useReceipts";
import { errorDetail, errorStatus } from "@/lib/api";
import { useRouter } from "@/i18n/navigation";
import { Wara } from "@/components/illustrations/Wara";
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
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Picked = { file: File; url: string | null; key: string };

export default function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("upload");
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useUploadReceipts();

  const add = useCallback((files: File[]) => {
    setPicked((prev) => [
      ...prev,
      ...files.map((file) => ({
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      })),
    ]);
  }, []);

  const reset = useCallback(() => {
    setPicked((prev) => {
      prev.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      return [];
    });
    setProgress(0);
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject, open: browse } = useDropzone({
    onDrop: add,
    accept: ACCEPT,
    multiple: true,
    disabled: isPending,
    noClick: true,
    noKeyboard: true,
  });

  const remove = (key: string) =>
    setPicked((prev) => {
      const hit = prev.find((p) => p.key === key);
      if (hit?.url) URL.revokeObjectURL(hit.url);
      return prev.filter((p) => p.key !== key);
    });

  const totalBytes = useMemo(() => picked.reduce((n, p) => n + p.file.size, 0), [picked]);

  const handleUpload = async () => {
    if (picked.length === 0) return;
    setProgress(0);
    try {
      const { receipts } = await mutateAsync({
        files: picked.map((p) => p.file),
        onProgress: setProgress,
      });
      const onReceipts = pathname.endsWith("/receipts");
      toast.success(t("sent.title", { count: receipts.length, n: String(receipts.length) }), {
        description: t("sent.description"),
        action: onReceipts
          ? undefined
          : { label: t("sent.action"), onClick: () => router.push("/receipts") },
      });
      close();
    } catch (err) {
      const status = errorStatus(err);
      if (status === 402) {
        toast.error(t("errors.quota"), {
          description: errorDetail(err),
          action: { label: t("errors.quotaAction"), onClick: () => router.push("/profile") },
        });
      } else if (status === 429) {
        toast.error(t("errors.rate"));
      } else {
        toast.error(t("errors.generic"), { description: errorDetail(err) });
      }
    }
  };

  const pct = Math.round(progress * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isPending) close();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps({
            onClick: () => !isPending && browse(),
            onKeyDown: (e) => {
              if ((e.key === "Enter" || e.key === " ") && !isPending) {
                e.preventDefault();
                browse();
              }
            },
          })}
          role="button"
          tabIndex={0}
          aria-label={t("dropzone.aria")}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-7 text-center outline-none transition-[border-color,background-color,transform] duration-200",
            "focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-lime/45",
            isDragActive && !isDragReject
              ? "scale-[1.01] border-solid border-foreground bg-lime/25"
              : "border-input bg-muted/40 hover:border-foreground/40 hover:bg-muted/70",
            isDragReject && "border-destructive bg-destructive/5",
            isPending && "pointer-events-none opacity-60",
          )}
        >
          <input {...getInputProps()} />
          <Wara
            pose={isDragActive ? "hungry" : picked.length ? "proud" : "idle"}
            className="w-24 text-ink transition-transform duration-200 group-hover:-translate-y-0.5 dark:text-bone"
          />
          <p className="font-heading text-lg font-semibold">
            {isDragReject ? t("dropzone.reject") : isDragActive ? t("dropzone.active") : t("dropzone.idle")}
          </p>
          <p className="text-xs text-muted-foreground">{t("dropzone.formats")}</p>
        </div>

        {/* Camera first on phones: the fastest way to capture a paper receipt. */}
        <div className="hidden gap-2 pointer-coarse:grid pointer-coarse:grid-cols-2">
          <Button type="button" variant="ink" size="lg" onClick={() => cameraRef.current?.click()} disabled={isPending}>
            <Camera className="size-5" />
            {t("camera")}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={browse} disabled={isPending}>
            <ImagePlus className="size-5" />
            {t("gallery")}
          </Button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {picked.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("selected", { count: picked.length, n: String(picked.length) })}</span>
              <span className="num">{formatBytes(totalBytes)}</span>
            </div>
            <ul className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4">
              <AnimatePresence initial={false}>
                {picked.map((p) => (
                  <motion.li
                    key={p.key}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
                    className="group/thumb relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted"
                  >
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                      <img src={p.url} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-muted-foreground">
                        <FileText className="size-7" aria-hidden />
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-1.5 py-1 text-[10px] text-bone">
                      {p.file.name}
                    </span>
                    {!isPending && (
                      <button
                        type="button"
                        onClick={() => remove(p.key)}
                        aria-label={t("remove", { name: p.file.name })}
                        className="absolute end-1 top-1 grid size-7 cursor-pointer place-items-center rounded-full bg-ink/80 text-bone transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-lime"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}

        {isPending && (
          <div className="space-y-1.5" aria-live="polite">
            <div className="flex justify-between text-xs font-medium">
              <span>{pct < 100 ? t("progress.sending") : t("progress.handingOver")}</span>
              <span className="num">{pct}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("progress.sending")}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleUpload} disabled={isPending || picked.length === 0}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? t("sending") : t("send", { count: picked.length, n: String(picked.length) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
