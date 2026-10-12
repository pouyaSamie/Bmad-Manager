"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle, Check, Layers, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteRepo } from "@/actions/repo-actions";

interface DeleteProjectDialogProps {
  owner: string;
  name: string;
  displayName: string;
  sourceType?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteProjectDialog({
  owner,
  name,
  displayName,
  sourceType = "local",
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSuccess,
}: DeleteProjectDialogProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (setControlledOpen ?? (() => {})) : setInternalOpen;

  const [removalMode, setRemovalMode] = useState<"unlink" | "uninstall">("unlink");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocal = sourceType === "local";

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const result = await deleteRepo({
        owner,
        name,
        uninstallBmad: isLocal && removalMode === "uninstall",
      });

      if (result.success) {
        setOpen(false);
        onSuccess?.();

        // If currently viewing this project, navigate back to dashboard
        if (pathname.startsWith(`/repo/${owner}/${name}`)) {
          router.push("/");
        }
        router.refresh();
        return;
      }

      setError(result.error);
    } catch {
      setError("An unexpected error occurred while removing the project.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (deleting) return;
        setOpen(value);
        if (!value) {
          setError(null);
          setRemovalMode("unlink");
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Remove {displayName}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select your preferred removal options for this project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Option 1: Safe Unlink */}
          <div
            onClick={() => setRemovalMode("unlink")}
            className={`relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
              removalMode === "unlink"
                ? "border-info bg-info/5 ring-1 ring-info"
                : "border-border/70 hover:bg-muted/40"
            }`}
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Remove from Dashboard only</span>
                {removalMode === "unlink" && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-info text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-normal">
                Unlinks this project from Bmad-Manager. Your source code, local folders, BMAD artifacts,
                and git history remain 100% untouched on your system.
              </p>
            </div>
          </div>

          {/* Option 2: Full Uninstall (only for local projects) */}
          {isLocal && (
            <div
              onClick={() => setRemovalMode("uninstall")}
              className={`relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                removalMode === "uninstall"
                  ? "border-destructive bg-destructive/5 ring-1 ring-destructive"
                  : "border-border/70 hover:bg-muted/40"
              }`}
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">
                    Remove from Dashboard & Uninstall BMAD
                  </span>
                  {removalMode === "uninstall" && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-normal">
                  Removes the project from the dashboard and deletes BMAD assets (<code className="text-2xs font-mono">_bmad/</code>,{" "}
                  <code className="text-2xs font-mono">_bmad-output/</code>, and{" "}
                  <code className="text-2xs font-mono">.agents/skills/</code>) from your project folder. Your source code is preserved.
                </p>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant={removalMode === "uninstall" ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : removalMode === "uninstall" ? (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove & Uninstall BMAD</span>
              </>
            ) : (
              <span>Remove from Dashboard</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
