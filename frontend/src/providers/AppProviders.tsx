"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import QueryProvider from "@/providers/QueryProvider";
import AuthProvider from "@/providers/AuthProvider";

export default function AppProviders({
  children,
  dir,
}: {
  children: React.ReactNode;
  dir: "rtl" | "ltr";
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <QueryProvider>
          <AuthProvider>
            <TooltipProvider delay={300}>
              {children}
              <Toaster
                dir={dir}
                position="top-center"
                offset={16}
                mobileOffset={12}
                toastOptions={{
                  classNames: {
                    toast:
                      "!rounded-2xl !border-border !bg-popover !text-popover-foreground !shadow-lift !font-sans",
                    description: "!text-muted-foreground",
                    actionButton: "!rounded-full !bg-primary !text-primary-foreground !font-medium",
                  },
                }}
              />
            </TooltipProvider>
          </AuthProvider>
        </QueryProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
