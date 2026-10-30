import {
  Bus,
  Clapperboard,
  HeartPulse,
  type LucideIcon,
  ReceiptText,
  Shapes,
  ShoppingBag,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingBasket,
  dining: UtensilsCrossed,
  transport: Bus,
  shopping: ShoppingBag,
  bills: ReceiptText,
  health: HeartPulse,
  entertainment: Clapperboard,
  other: Shapes,
};

export function CategoryIcon({ category, className }: { category: string | null | undefined; className?: string }) {
  const Icon = (category && ICONS[category]) || ReceiptText;
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground", className)}>
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
    </span>
  );
}
