/** Button styles, kept outside the client component so server components can use them on links. */
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap",
    "transition-[transform,background-color,box-shadow,color,border-color] duration-150 ease-[var(--ease-out-soft)]",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        // Lime with an ink "print" edge: the one primary action on a screen.
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(10_10_11/0.22)] hover:bg-lime-deep",
        ink: "bg-foreground text-background hover:bg-foreground/88",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-destructive",
        outline:
          "border border-input bg-card text-foreground hover:border-foreground/30 hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        link: "rounded-md text-brand-text underline decoration-2 underline-offset-4 hover:decoration-lime",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 gap-1.5 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
