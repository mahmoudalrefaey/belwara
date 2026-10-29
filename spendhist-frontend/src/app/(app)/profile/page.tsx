"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import AccountCard from "@/components/profile/AccountCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { fmtDate } from "@/lib/format";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { useAuth } from "@/providers/AuthProvider";
import type { UserPrefs } from "@/types/api";

type Currency = UserPrefs["defaultCurrency"];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "EGP", label: "Egyptian Pound (EGP)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "SAR", label: "Saudi Riyal (SAR)" },
];

function userInitials(fullName: string | null | undefined, email: string) {
  if (fullName?.trim()) {
    return fullName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-xs" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-full" />
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const { data: user, isLoading, isPending } = useUser();
  const { theme, setTheme } = useTheme();

  const [currency, setCurrency] = useState<Currency>("EGP");
  const [themeReady, setThemeReady] = useState(false);

  // localStorage prefs apply after mount (SSR used defaults above).
  useEffect(() => {
    startTransition(() => {
      setCurrency(getPrefs().defaultCurrency);
      setThemeReady(true);
    });
  }, []);

  const showSkeleton = !user && (isLoading || isPending);

  const initials = useMemo(() => {
    if (!user) return "?";
    return userInitials(user.full_name, user.email);
  }, [user]);

  if (showSkeleton) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
        Could not load profile.
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto flex max-w-2xl flex-col gap-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account details and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-indigo-600 text-lg font-medium text-white dark:bg-indigo-500">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-lg">
                {user.full_name?.trim() || "No name set"}
              </CardTitle>
              <CardDescription className="text-base text-foreground/80">
                {user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-muted-foreground">Phone</span>
            <span>{user.phone_number?.trim() || "Not provided"}</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span>{fmtDate(user.created_at)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Default currency and appearance for this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="currency-select">Default currency</Label>
            <Select
              value={currency}
              onValueChange={(value) => {
                if (value === "EGP" || value === "USD" || value === "SAR") {
                  setCurrency(value);
                  setPrefs({ defaultCurrency: value });
                }
              }}
            >
              <SelectTrigger
                id="currency-select"
                className="w-full min-w-0 max-w-full"
                size="default"
              >
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "light" as const, label: "Light", icon: Sun },
                  { id: "dark" as const, label: "Dark", icon: Moon },
                  { id: "system" as const, label: "System", icon: Monitor },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active =
                  themeReady && (theme === id || (theme == null && id === "system"));
                return (
                  <Button
                    key={id}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className="h-auto flex-col gap-1.5 py-3"
                    onClick={() => {
                      setTheme(id);
                      setPrefs({ theme: id });
                    }}
                  >
                    <Icon className="size-4" />
                    <span className="text-xs font-medium">{label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-0 border-t bg-transparent pt-4">
          <Button
            variant="destructive"
            className="w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:hover:bg-destructive/90"
            onClick={() => logout()}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </CardFooter>
      </Card>

      <AccountCard />
    </motion.div>
  );
}
