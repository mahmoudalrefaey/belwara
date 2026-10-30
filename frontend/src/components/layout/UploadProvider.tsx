"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import UploadModal from "@/components/receipts/UploadModal";

const UploadContext = createContext<{ openUpload: () => void } | null>(null);

/** One upload flow for the whole app: the sidebar, the mobile "Scan" tab and empty states open it. */
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openUpload = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openUpload }), [openUpload]);
  return (
    <UploadContext.Provider value={value}>
      {children}
      <UploadModal open={open} onClose={() => setOpen(false)} />
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
