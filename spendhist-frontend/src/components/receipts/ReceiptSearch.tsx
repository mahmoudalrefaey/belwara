"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ReceiptSearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function ReceiptSearch({
  value,
  onChange,
  className,
}: ReceiptSearchProps) {
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search receipts..."
        className="pl-9"
        aria-label="Search receipts"
      />
    </div>
  );
}
