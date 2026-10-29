"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { downloadMyData, useDeleteAccount, useUsage } from "@/hooks/useUser";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {limit ? `${used} / ${limit}` : `${used} · unlimited`}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={pct >= 100 ? "h-full bg-destructive" : "h-full bg-primary"}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function AccountCard() {
  const { logout } = useAuth();
  const { data: usage } = useUsage();
  const { mutateAsync: deleteAccount, isPending } = useDeleteAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMyData();
    } catch {
      toast.error("Could not export your data. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount(password);
      toast.success("Your account has been deleted");
      logout();
    } catch {
      toast.error("Password is incorrect.");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {usage ? `${usage.plan === "pro" ? "Pro" : "Free"} plan · usage this month` : "Usage this month"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usage && (
            <>
              <UsageRow label="Receipts" {...usage.receipts} />
              <UsageRow label="Chat messages" {...usage.chat} />
            </>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2 border-t bg-transparent pt-4">
          <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" />
            Export my data
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete account
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPassword("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your receipts, uploaded files and chat history.
              You cannot undo this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Confirm with your password</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isPending || !password}
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
